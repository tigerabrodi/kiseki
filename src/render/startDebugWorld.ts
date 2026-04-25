import * as THREE from 'three/webgpu'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import WebGPU from 'three/addons/capabilities/WebGPU.js'

import { getFlyMovementIntent } from '../camera/getFlyMovementIntent.ts'
import { FixedStepLoop } from '../core/FixedStepLoop.ts'
import { buildGpuPipelineInfo } from '../debug/buildGpuPipelineInfo.ts'
import type { KisekiDebugStats } from '../debug/installKisekiDebugSurface.ts'
import { getGpuAllocationSnapshot } from '../gpu/getGpuAllocationSnapshot.ts'
import type { GpuChunkMeshCache } from '../gpu/GpuChunkMeshCache.ts'
import type { GpuChunkIndirectDrawCuller } from '../gpu/GpuChunkIndirectDrawCuller.ts'
import type { GpuChunkMeshSlab } from '../gpu/GpuChunkMeshSlab.ts'
import type { GpuChunkMesher } from '../gpu/GpuChunkMesher.ts'
import type { GpuChunkOcclusionCuller } from '../gpu/GpuChunkOcclusionCuller.ts'
import type { GpuChunkVoxelCache } from '../gpu/GpuChunkVoxelCache.ts'
import type { GpuChunkVisibilityCuller } from '../gpu/GpuChunkVisibilityCuller.ts'
import type { GpuTerrainGenerator } from '../gpu/GpuTerrainGenerator.ts'
import type { GpuVoxelSlab } from '../gpu/GpuVoxelSlab.ts'
import {
  applyVoxelEdit,
  type VoxelEditMode,
} from '../interaction/applyVoxelEdit.ts'
import {
  formatProfileReport,
  ProfileRecorder,
} from '../profiling/ProfileRecorder.ts'
import { Chunk } from '../voxel/chunk.ts'
import { applyProfileHud as renderProfileHud } from './applyProfileHud.ts'
import { createDebugWorldMarkup } from './createDebugWorldMarkup.ts'
import { createDebugWorldGpuRuntime } from './createDebugWorldGpuRuntime.ts'
import { createDebugWorldScene } from './createDebugWorldScene.ts'
import { createGpuIndirectDrawProfileSampler } from './createGpuIndirectDrawProfileSampler.ts'
import { createGpuMeshStatsRefresher } from './createGpuMeshStatsRefresher.ts'
import { createGpuOcclusionController } from './createGpuOcclusionController.ts'
import { createGpuVisibilityTracker } from './createGpuVisibilityTracker.ts'
import type { VoxelMaterialGallery } from './createVoxelMaterialGallery.ts'
import {
  bytesToMegabytes,
  createInputState,
  type DebugWorldHandle,
  disposeChunkMeshPool,
  type DisposableMesh,
  getJsHeapBytes,
  getPipelineState,
  turnCameraByDegrees,
  updatePointerHud,
} from './debugWorldHelpers.ts'
import { getDebugWorldElements } from './getDebugWorldElements.ts'
import { installDebugWorldEventHandlers } from './installDebugWorldEventHandlers.ts'
import { installDebugWorldSurface } from './installDebugWorldSurface.ts'
import { createGpuMeshCompactionScheduler } from './createGpuMeshCompactionScheduler.ts'
import { setupInitialCameraPose } from './setupInitialCameraPose.ts'
import { syncStreamedGpuChunkMeshes } from './syncStreamedGpuChunkMeshes.ts'
import { syncStreamedGpuVoxelBuffers } from './syncStreamedGpuVoxelBuffers.ts'
import {
  type ChunkStreamUpdate,
  ChunkStreamer,
  worldPositionToChunkCoordinates,
} from '../world/ChunkStreamer.ts'
import { VoxelOverrideStore } from '../world/VoxelOverrideStore.ts'
import { chunkKey } from '../world/World.ts'
import { TerrainGenerator } from '../world/TerrainGenerator.ts'

export async function startDebugWorld(
  root: HTMLElement
): Promise<DebugWorldHandle> {
  root.innerHTML = createDebugWorldMarkup()
  const {
    chunkCountValue,
    copyProfileButton,
    cpuTimeValue,
    drawCallsValue,
    editedVoxelsValue,
    faceCountValue,
    fixedRateValue,
    fpsValue,
    gpuMeshCountValue,
    gpuMeshMegabytesValue,
    gpuTimeValue,
    gpuVoxelCountValue,
    gpuVoxelMegabytesValue,
    lockButton,
    meshTimeValue,
    pipelineStateValue,
    playerChunkValue,
    pointerStateValue,
    positionValue,
    profileButton,
    profileReportValue,
    profileStateValue,
    statusValue,
    terrainTimeValue,
    triangleCountValue,
    vertexBytesValue,
    viewport,
    visibleChunksValue,
  } = getDebugWorldElements(root)

  if (!WebGPU.isAvailable()) {
    statusValue.textContent = 'WebGPU unavailable'
    viewport.append(WebGPU.getErrorMessage())
    return () => {
      root.innerHTML = ''
    }
  }

  const { camera, canvas, renderer, scene } = createDebugWorldScene(viewport)
  const movementSpeed = 8

  const terrainGenerator = new TerrainGenerator({ seed: 'kiseki' })
  const chunkStreamer = new ChunkStreamer({
    createChunk: () => new Chunk(),
    loadRadius: { x: 2, y: 1, z: 2 },
    unloadBuffer: { x: 1, y: 1, z: 1 },
  })
  const maxRetainedChunkCount = chunkStreamer.getMaxRetainedChunkCount()
  const worldGroup = new THREE.Group()
  scene.add(worldGroup)
  let chunkMeshes: Array<DisposableMesh> = []
  const chunkMeshMap = new Map<string, DisposableMesh>()
  const chunkMeshSlotMap = new Map<number, DisposableMesh>()
  let drawCalls = 0
  let totalFaceCount = 0
  let totalTriangleCount = 0
  let smoothedFps = 60
  let lastCpuFrameTimeMs = 0
  let lastGpuFrameTimeMs: number | null = null
  let lastMeshGenerationTimeMs = 0
  let lastTerrainGenerationTimeMs = 0
  let hdrEnvironmentName: string | null = null
  let voxelChunkMaterial: THREE.MeshStandardNodeMaterial | null = null
  let voxelMaterialGallery: VoxelMaterialGallery | null = null
  let disposeHdrEnvironment = (): void => {}
  let gpuDevice: GPUDevice | null = null
  let gpuChunkIndirectDrawCuller: GpuChunkIndirectDrawCuller | null = null
  let gpuChunkMesher: GpuChunkMesher | null = null
  let gpuChunkMeshCache: GpuChunkMeshCache | null = null
  let gpuChunkMeshSlab: GpuChunkMeshSlab | null = null
  let gpuChunkOcclusionCuller: GpuChunkOcclusionCuller | null = null
  let gpuChunkVisibilityCuller: GpuChunkVisibilityCuller | null = null
  let gpuTerrainGenerator: GpuTerrainGenerator | null = null
  let gpuVoxelCache: GpuChunkVoxelCache | null = null
  let gpuVoxelSlab: GpuVoxelSlab | null = null
  let pendingGpuTimestampResolve: Promise<void> | null = null
  let renderFramesSinceGpuResolve = 0
  let isVoxelEditInFlight = false
  const profileRecorder = new ProfileRecorder()
  const gpuIndirectDrawProfileSampler = createGpuIndirectDrawProfileSampler({
    getCuller: () => gpuChunkIndirectDrawCuller,
    recorder: profileRecorder,
  })
  const voxelOverrideStore = new VoxelOverrideStore()
  let getCurrentPlayerMeshSlotIndex = (): number | null => null
  const gpuOcclusionController = createGpuOcclusionController({
    getChunkEntries: () => chunkStreamer.world.entries(),
    getGpuChunkMeshCache: () => gpuChunkMeshCache,
    getGpuOcclusionCuller: () => gpuChunkOcclusionCuller,
    getGpuVoxelCache: () => gpuVoxelCache,
    getPlayerMeshSlotIndex: () => getCurrentPlayerMeshSlotIndex(),
  })

  const gpuMeshStatsRefresher = createGpuMeshStatsRefresher({
    getChunkEntries: () => chunkStreamer.world.entries(),
    getGpuChunkMeshCache: () => gpuChunkMeshCache,
    getGpuDevice: () => gpuDevice,
    onStats: (stats) => {
      drawCalls = stats.drawCalls
      totalFaceCount = stats.faceCount
      totalTriangleCount = stats.triangleCount
      applyStatsToHud()
    },
    setChunkRenderable: (key, isRenderable) => {
      const mesh = chunkMeshMap.get(key)

      if (mesh !== undefined) {
        mesh.visible = isRenderable
      }
    },
  })
  const gpuVisibilityTracker = createGpuVisibilityTracker({
    afterCull: () => gpuChunkIndirectDrawCuller?.apply(),
    beforeCull: () => gpuOcclusionController.cullIfNeeded(),
    getCuller: () => gpuChunkVisibilityCuller,
    onVisibilityInfoChange: () => applyStatsToHud(),
  })

  const gpuMeshCompactionScheduler = createGpuMeshCompactionScheduler({
    getMeshCache: () => gpuChunkMeshCache,
    getMeshSlab: () => gpuChunkMeshSlab,
    onAfterCompaction: () => {
      gpuVisibilityTracker.cull(camera, true)
      void gpuMeshStatsRefresher.refresh()
    },
  })

  const syncGpuChunkMeshes = (
    update: Pick<ChunkStreamUpdate, 'loaded' | 'unloaded'>
  ): void => {
    const activeGpuChunkMeshCache = gpuChunkMeshCache
    const activeGpuChunkMesher = gpuChunkMesher
    const activeGpuVoxelCache = gpuVoxelCache
    const activeMaterial = voxelChunkMaterial

    if (
      activeGpuChunkMeshCache === null ||
      activeGpuChunkMesher === null ||
      activeGpuVoxelCache === null ||
      activeMaterial === null
    ) {
      return
    }

    const result = syncStreamedGpuChunkMeshes({
      chunkMeshCache: activeGpuChunkMeshCache,
      chunkMeshSlotMap,
      chunkMesher: activeGpuChunkMesher,
      chunkMeshMap,
      gpuVoxelCache: activeGpuVoxelCache,
      material: activeMaterial,
      update,
      worldGroup,
      worldHasChunk: (coords) => chunkStreamer.world.hasChunk(coords),
    })

    chunkMeshes = result.chunkMeshes
    lastMeshGenerationTimeMs = result.meshGenerationTimeMs
    gpuOcclusionController.syncGraph()

    if (result.remeshedChunkCount > 0) {
      profileRecorder.recordMeshGeneration(
        lastMeshGenerationTimeMs,
        result.remeshedChunkCount
      )
    }
  }

  const syncStreamedWorld = (position: THREE.Vector3): void => {
    const streamUpdate = chunkStreamer.updateFromWorldPosition(position)

    if (streamUpdate.didChange) {
      const voxelSyncResult = syncStreamedGpuVoxelBuffers({
        gpuTerrainGenerator,
        gpuVoxelCache,
        update: streamUpdate,
      })
      lastTerrainGenerationTimeMs = voxelSyncResult.terrainGenerationTimeMs

      if (voxelSyncResult.generatedChunkCount > 0) {
        profileRecorder.recordTerrainGeneration(
          lastTerrainGenerationTimeMs,
          voxelSyncResult.generatedChunkCount
        )
      }

      syncGpuChunkMeshes(streamUpdate)
      gpuMeshCompactionScheduler.schedule()
    }

    applyStatsToHud()
  }

  const initialPosition = setupInitialCameraPose(camera, terrainGenerator)

  const controls = new PointerLockControls(camera, canvas)
  controls.pointerSpeed = 0.75

  const inputState = createInputState()
  const previousCameraPosition = initialPosition.clone()
  const currentCameraPosition = initialPosition.clone()

  getCurrentPlayerMeshSlotIndex = (): number | null => {
    const playerChunk = worldPositionToChunkCoordinates(currentCameraPosition)

    return gpuChunkMeshCache?.getMesh(playerChunk)?.slotIndex ?? null
  }

  const buildStatsSnapshot = (): KisekiDebugStats => {
    const playerChunk = worldPositionToChunkCoordinates(currentCameraPosition)
    const loadedChunkCount = chunkStreamer.world.size()
    const gpuVoxelBufferCount = gpuVoxelCache?.size() ?? 0
    const gpuMeshBufferCount = gpuChunkMeshCache?.size() ?? 0
    const hasGpuFullPipeline =
      loadedChunkCount > 0 &&
      gpuVoxelBufferCount === loadedChunkCount &&
      gpuMeshBufferCount === loadedChunkCount &&
      gpuTerrainGenerator !== null &&
      gpuChunkMesher !== null &&
      voxelChunkMaterial !== null

    return {
      cpuTimeMs: lastCpuFrameTimeMs,
      drawCalls,
      editedVoxelCount: voxelOverrideStore.voxelCount(),
      faceCount: totalFaceCount,
      fps: smoothedFps,
      gpuMeshBufferBytes:
        gpuChunkMeshSlab?.reservedByteLength() ??
        gpuChunkMeshCache?.totalBytes() ??
        0,
      gpuMeshBufferCount,
      gpuVoxelBufferBytes:
        gpuVoxelSlab?.reservedByteLength() ?? gpuVoxelCache?.totalBytes() ?? 0,
      gpuVoxelBufferCount,
      gpuTimeMs: lastGpuFrameTimeMs,
      loadedChunkCount,
      meshGenerationTimeMs: lastMeshGenerationTimeMs,
      pipelineState: getPipelineState(
        hasGpuFullPipeline,
        gpuChunkVisibilityCuller !== null,
        gpuChunkIndirectDrawCuller !== null,
        gpuChunkOcclusionCuller !== null
      ),
      playerChunk,
      position: {
        x: currentCameraPosition.x,
        y: currentCameraPosition.y,
        z: currentCameraPosition.z,
      },
      terrainGenerationTimeMs: lastTerrainGenerationTimeMs,
      triangleCount: totalTriangleCount,
      vertexBytesPerVertex: 4,
      visibleChunkCount: gpuVisibilityTracker.getInfo()?.visibleChunkCount ?? 0,
    }
  }
  const captureGpuAllocationSnapshot = () =>
    getGpuAllocationSnapshot(gpuChunkMeshSlab, gpuVoxelSlab)

  const updateProfileHud = (): void => {
    renderProfileHud(
      {
        copyProfileButton,
        profileButton,
        profileReportValue,
        profileStateValue,
      },
      profileRecorder.getSessionState(performance.now())
    )
  }

  const applyStatsToHud = (): void => {
    const stats = buildStatsSnapshot()

    fpsValue.textContent = stats.fps.toFixed(1)
    cpuTimeValue.textContent = stats.cpuTimeMs.toFixed(2)
    gpuTimeValue.textContent =
      stats.gpuTimeMs === null ? 'n/a' : stats.gpuTimeMs.toFixed(2)
    meshTimeValue.textContent = stats.meshGenerationTimeMs.toFixed(2)
    terrainTimeValue.textContent = stats.terrainGenerationTimeMs.toFixed(2)
    gpuVoxelCountValue.textContent = stats.gpuVoxelBufferCount.toString()
    gpuVoxelMegabytesValue.textContent = bytesToMegabytes(
      stats.gpuVoxelBufferBytes
    ).toFixed(2)
    gpuMeshCountValue.textContent = stats.gpuMeshBufferCount.toString()
    gpuMeshMegabytesValue.textContent = bytesToMegabytes(
      stats.gpuMeshBufferBytes
    ).toFixed(2)
    vertexBytesValue.textContent = stats.vertexBytesPerVertex.toString()
    pipelineStateValue.textContent = stats.pipelineState
    chunkCountValue.textContent = stats.loadedChunkCount.toString()
    playerChunkValue.textContent = chunkKey(stats.playerChunk)
    visibleChunksValue.textContent = stats.visibleChunkCount.toString()
    positionValue.textContent = `${stats.position.x.toFixed(
      1
    )}, ${stats.position.y.toFixed(1)}, ${stats.position.z.toFixed(1)}`
    faceCountValue.textContent = stats.faceCount.toString()
    triangleCountValue.textContent = stats.triangleCount.toString()
    drawCallsValue.textContent = stats.drawCalls.toString()
    editedVoxelsValue.textContent = stats.editedVoxelCount.toString()
    updateProfileHud()
  }

  const updatePointerState = (): void =>
    updatePointerHud(controls.isLocked, lockButton, pointerStateValue)

  const resolveGpuTimestampIfNeeded = (): void => {
    if (
      pendingGpuTimestampResolve !== null ||
      renderFramesSinceGpuResolve < 15
    ) {
      return
    }

    renderFramesSinceGpuResolve = 0
    pendingGpuTimestampResolve = renderer
      .resolveTimestampsAsync(THREE.TimestampQuery.RENDER)
      .then((timestampMs) => {
        if (typeof timestampMs === 'number') {
          lastGpuFrameTimeMs = timestampMs

          if (profileRecorder.isRecording()) {
            profileRecorder.recordGpuTime(timestampMs)
          }
        }
      })
      .finally(() => {
        pendingGpuTimestampResolve = null
      })
  }

  const flushGpuTimestamp = async (): Promise<void> => {
    if (pendingGpuTimestampResolve !== null) {
      await pendingGpuTimestampResolve
    }

    const timestampMs = await renderer.resolveTimestampsAsync(
      THREE.TimestampQuery.RENDER
    )

    if (typeof timestampMs === 'number') {
      lastGpuFrameTimeMs = timestampMs
      profileRecorder.recordGpuTime(timestampMs)
    }
  }

  const onKeyChange =
    (pressed: boolean) =>
    (event: KeyboardEvent): void => {
      switch (event.code) {
        case 'KeyW':
          inputState.forward = pressed
          break
        case 'KeyS':
          inputState.backward = pressed
          break
        case 'KeyA':
          inputState.left = pressed
          break
        case 'KeyD':
          inputState.right = pressed
          break
        case 'Space':
          inputState.up = pressed
          break
        case 'ShiftLeft':
        case 'ShiftRight':
          inputState.down = pressed
          break
        default:
          return
      }

      event.preventDefault()
    }

  const handleKeyDown = onKeyChange(true)
  const handleKeyUp = onKeyChange(false)
  const handleLock = (): void => updatePointerState()
  const handleUnlock = (): void => updatePointerState()
  const handleLockButtonClick = (): void => {
    if (!controls.isLocked) controls.lock(true)
  }
  const handleProfileButtonPress = (): void => void handleProfileButtonClick()
  const handleCopyProfileButtonPress = (): void =>
    void handleCopyProfileButtonClick()
  const handleProfileButtonClick = async (): Promise<void> => {
    if (profileRecorder.isRecording()) {
      profileButton.disabled = true
      try {
        await flushGpuTimestamp()
        await gpuIndirectDrawProfileSampler.flush()
        profileRecorder.stop(performance.now(), captureGpuAllocationSnapshot())
      } finally {
        profileButton.disabled = false
        applyStatsToHud()
      }
      return
    }

    profileRecorder.start(performance.now(), captureGpuAllocationSnapshot())
    applyStatsToHud()
  }
  const handleCopyProfileButtonClick = async (): Promise<void> => {
    const report = profileRecorder.getLastReport()

    if (report === null) {
      return
    }

    await navigator.clipboard.writeText(formatProfileReport(report))
  }
  const handleVoxelEdit = async (
    mode: VoxelEditMode,
    requirePointerLock = true
  ): Promise<{
    didEdit: boolean
    message: string
    touchedChunkCount: number
  }> => {
    if (
      (requirePointerLock && !controls.isLocked) ||
      gpuDevice === null ||
      gpuChunkMesher === null ||
      gpuChunkMeshCache === null ||
      gpuVoxelCache === null ||
      isVoxelEditInFlight
    ) {
      return {
        didEdit: false,
        message: 'Pointer is unlocked or GPU world is not ready',
        touchedChunkCount: 0,
      }
    }

    isVoxelEditInFlight = true

    try {
      const result = await applyVoxelEdit({
        camera,
        chunkStreamer,
        device: gpuDevice,
        gpuChunkMeshCache,
        gpuChunkMesher,
        gpuVoxelCache,
        mode,
        overrideStore: voxelOverrideStore,
      })

      statusValue.textContent = result.message

      if (result.didEdit) {
        gpuOcclusionController.syncGraph()
        gpuVisibilityTracker.cull(camera, true)
        gpuMeshCompactionScheduler.schedule()
      }

      return result
    } finally {
      isVoxelEditInFlight = false
      applyStatsToHud()
    }
  }
  const handleViewportMouseDown = (event: MouseEvent): void => {
    if (event.button === 0) {
      event.preventDefault()
      void handleVoxelEdit('break')
    }

    if (event.button === 2) {
      event.preventDefault()
      void handleVoxelEdit('place')
    }
  }
  const handleViewportContextMenu = (event: MouseEvent): void => {
    event.preventDefault()
  }

  const uninstallEventHandlers = installDebugWorldEventHandlers({
    canvas,
    controls,
    copyProfileButton,
    handleCopyProfileButtonPress,
    handleKeyDown,
    handleKeyUp,
    handleLock,
    handleLockButtonClick,
    handleProfileButtonPress,
    handleUnlock,
    handleViewportContextMenu,
    handleViewportMouseDown,
    lockButton,
    profileButton,
  })
  updatePointerState()

  fixedRateValue.textContent = '60'
  applyStatsToHud()
  const fixedLoop = new FixedStepLoop({ fixedDeltaSeconds: 1 / 60 })

  const uninstallDebugSurface = installDebugWorldSurface({
    breakTargetBlock: async () => handleVoxelEdit('break', false),
    buildPipelineInfo: () =>
      buildGpuPipelineInfo({
        chunkEntries: chunkStreamer.world.entries(),
        gpuMeshBufferCount: gpuChunkMeshCache?.size() ?? 0,
        gpuVoxelBufferCount: gpuVoxelCache?.size() ?? 0,
        overrideChunkCount: voxelOverrideStore.chunkCount(),
        overrideVoxelCount: voxelOverrideStore.voxelCount(),
        usesGpuFrustumCulling: gpuChunkVisibilityCuller !== null,
        usesGpuIndirectDrawCulling: gpuChunkIndirectDrawCuller !== null,
        usesGpuOcclusionCulling: gpuChunkOcclusionCuller !== null,
        usesGpuMeshGeneration: gpuChunkMesher !== null,
        usesGpuMeshRendering: voxelChunkMaterial !== null,
        usesGpuTerrainGeneration: gpuTerrainGenerator !== null,
      }),
    buildStatsSnapshot,
    camera,
    chunkMeshes: () => chunkMeshes,
    chunkStreamer,
    createReferenceChunk: (coords): Chunk =>
      voxelOverrideStore.applyToChunk(
        coords,
        terrainGenerator.createChunk(coords)
      ),
    getGpuChunkMeshCache: () => gpuChunkMeshCache,
    getGpuAllocationInfo: () => captureGpuAllocationSnapshot(),
    getGpuDevice: () => gpuDevice,
    getGpuIndirectDrawInfo: () => gpuIndirectDrawProfileSampler.readInfo(),
    getGpuMeshCompactionInfo: () =>
      gpuChunkMeshSlab?.getCompactionInfo() ?? null,
    getGpuOcclusionInfo: async () =>
      gpuChunkOcclusionCuller === null
        ? null
        : await gpuChunkOcclusionCuller.readInfo(),
    getGpuTerrainErrorMessage: () =>
      gpuTerrainGenerator?.getLastErrorMessage() ?? null,
    getGpuVisibilityInfo: () => gpuVisibilityTracker.readInfo(),
    getGpuVoxelCache: () => gpuVoxelCache,
    getHdrEnvironmentName: () => hdrEnvironmentName,
    getMaterialGalleryInfo: () => voxelMaterialGallery?.info() ?? null,
    getProfileReport: () => profileRecorder.getLastReport(),
    getProfileState: () => profileRecorder.getSessionState(performance.now()),
    getScene: () => scene,
    placeTargetBlock: async () => handleVoxelEdit('place', false),
    setCameraPosition: (x: number, y: number, z: number): void => {
      currentCameraPosition.set(x, y, z)
      previousCameraPosition.copy(currentCameraPosition)
      camera.position.copy(currentCameraPosition)
      camera.updateMatrixWorld()
      syncStreamedWorld(currentCameraPosition)
      gpuVisibilityTracker.cull(camera, true)
    },
    setMaterialGalleryVisible: (isVisible: boolean): boolean => {
      voxelMaterialGallery?.setVisible(isVisible)
      voxelMaterialGallery?.syncToCamera(camera)
      return voxelMaterialGallery?.info().isVisible ?? false
    },
    startProfileSession: (): void => {
      profileRecorder.start(performance.now(), captureGpuAllocationSnapshot())
      applyStatsToHud()
    },
    stopProfileSession: async () => {
      await flushGpuTimestamp()
      await gpuIndirectDrawProfileSampler.flush()
      const report = profileRecorder.stop(
        performance.now(),
        captureGpuAllocationSnapshot()
      )
      applyStatsToHud()
      return report
    },
    syncWorld: (): void => {
      syncStreamedWorld(currentCameraPosition)
      gpuVisibilityTracker.cull(camera, true)
    },
    turnCamera: (yawDegrees: number, pitchDegrees = 0): void => {
      turnCameraByDegrees(camera, yawDegrees, pitchDegrees)
      gpuVisibilityTracker.cull(camera, true)
      applyStatsToHud()
    },
  })

  const resize = (): void => {
    const width = Math.max(viewport.clientWidth, 1)
    const height = Math.max(viewport.clientHeight, 1)

    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
  }

  const disposeRuntime = (): void => {
    void renderer.setAnimationLoop(null)
    window.removeEventListener('resize', resize)
    uninstallEventHandlers()
    uninstallDebugSurface()
    controls.dispose()
    disposeChunkMeshPool(chunkMeshSlotMap)
    gpuChunkMeshCache?.dispose()
    gpuChunkMeshSlab?.dispose()
    gpuChunkIndirectDrawCuller?.destroy()
    gpuChunkOcclusionCuller?.destroy()
    gpuChunkVisibilityCuller?.destroy()
    voxelMaterialGallery?.dispose()
    gpuChunkMesher?.destroy()
    gpuTerrainGenerator?.destroy()
    gpuVoxelCache?.dispose()
    gpuVoxelSlab?.dispose()
    disposeHdrEnvironment()
    voxelChunkMaterial?.dispose()
    void renderer.dispose()
  }

  window.addEventListener('resize', resize)
  resize()

  try {
    await renderer.init()
    statusValue.textContent = 'Loading assets'
    const gpuRuntime = await createDebugWorldGpuRuntime({
      maxRetainedChunkCount,
      renderer,
      scene,
    })

    gpuDevice = gpuRuntime.gpuDevice
    gpuVoxelSlab = gpuRuntime.gpuVoxelSlab
    gpuVoxelCache = gpuRuntime.gpuVoxelCache
    gpuTerrainGenerator = gpuRuntime.gpuTerrainGenerator
    gpuChunkMesher = gpuRuntime.gpuChunkMesher
    gpuChunkMeshSlab = gpuRuntime.gpuChunkMeshSlab
    gpuChunkVisibilityCuller = gpuRuntime.gpuChunkVisibilityCuller
    gpuChunkOcclusionCuller = gpuRuntime.gpuChunkOcclusionCuller
    gpuChunkIndirectDrawCuller = gpuRuntime.gpuChunkIndirectDrawCuller
    gpuChunkMeshCache = gpuRuntime.gpuChunkMeshCache
    voxelChunkMaterial = gpuRuntime.voxelChunkMaterial
    voxelMaterialGallery = gpuRuntime.voxelMaterialGallery
    hdrEnvironmentName = gpuRuntime.hdrEnvironmentName
    disposeHdrEnvironment = gpuRuntime.disposeHdrEnvironment
    statusValue.textContent = 'WebGPU ready'
  } catch (error) {
    statusValue.textContent = 'Renderer setup failed'
    const message = document.createElement('pre')
    message.textContent =
      error instanceof Error
        ? error.message
        : 'Unknown WebGPU initialization error or texture load failure'
    viewport.append(message)

    disposeRuntime()

    return () => {
      root.innerHTML = ''
    }
  }

  syncStreamedWorld(initialPosition)
  gpuVisibilityTracker.cull(camera, true)

  void renderer.setAnimationLoop((timestampMilliseconds?: number) => {
    const frameStartMs = performance.now()
    const timestampSeconds = (timestampMilliseconds ?? 0) / 1000
    const frame = fixedLoop.advance(timestampSeconds)
    const instantaneousFps =
      frame.frameTimeSeconds > 0 ? 1 / frame.frameTimeSeconds : smoothedFps

    if (frame.frameTimeSeconds > 0) {
      smoothedFps = THREE.MathUtils.lerp(smoothedFps, instantaneousFps, 0.15)
    }

    for (let step = 0; step < frame.steps; step += 1) {
      camera.position.copy(currentCameraPosition)
      camera.updateMatrix()
      previousCameraPosition.copy(currentCameraPosition)

      const movement = getFlyMovementIntent(inputState)
      controls.moveRight(
        movement.right * movementSpeed * frame.fixedDeltaSeconds
      )
      controls.moveForward(
        movement.forward * movementSpeed * frame.fixedDeltaSeconds
      )
      camera.position.y += movement.up * movementSpeed * frame.fixedDeltaSeconds

      currentCameraPosition.copy(camera.position)
    }

    if (frame.steps === 0) {
      previousCameraPosition.copy(currentCameraPosition)
    }

    camera.position.lerpVectors(
      previousCameraPosition,
      currentCameraPosition,
      frame.alpha
    )
    camera.updateMatrixWorld()

    syncStreamedWorld(currentCameraPosition)
    updatePointerState()
    gpuVisibilityTracker.cull(camera)
    voxelMaterialGallery?.syncToCamera(camera)

    void renderer.render(scene, camera)

    lastCpuFrameTimeMs = performance.now() - frameStartMs

    if (frame.frameTimeSeconds > 0) {
      profileRecorder.recordFrame({
        chunkCount: chunkStreamer.world.size(),
        cpuTimeMs: lastCpuFrameTimeMs,
        fps: instantaneousFps,
        gpuMemoryBytes: renderer.info.memory.total,
        gpuTimeMs: null,
        jsHeapBytes: getJsHeapBytes(),
        triangleCount: totalTriangleCount,
      })
      gpuIndirectDrawProfileSampler.tick()
    }

    renderFramesSinceGpuResolve += 1
    resolveGpuTimestampIfNeeded()

    applyStatsToHud()
  })

  return () => {
    disposeRuntime()
    root.innerHTML = ''
  }
}
