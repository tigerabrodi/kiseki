import * as THREE from 'three/webgpu'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import WebGPU from 'three/addons/capabilities/WebGPU.js'

import { getFlyMovementIntent } from '../camera/getFlyMovementIntent.ts'
import { FixedStepLoop } from '../core/FixedStepLoop.ts'
import { buildGpuPipelineInfo } from '../debug/buildGpuPipelineInfo.ts'
import type { KisekiDebugStats } from '../debug/installKisekiDebugSurface.ts'
import { GpuChunkMeshCache } from '../gpu/GpuChunkMeshCache.ts'
import { GpuChunkIndirectDrawCuller } from '../gpu/GpuChunkIndirectDrawCuller.ts'
import { GpuChunkMeshSlab } from '../gpu/GpuChunkMeshSlab.ts'
import { GpuTerrainGenerator } from '../gpu/GpuTerrainGenerator.ts'
import { GpuChunkVoxelCache } from '../gpu/GpuChunkVoxelCache.ts'
import { GpuChunkVisibilityCuller } from '../gpu/GpuChunkVisibilityCuller.ts'
import { GpuVoxelSlab } from '../gpu/GpuVoxelSlab.ts'
import { getGpuAllocationSnapshot } from '../gpu/getGpuAllocationSnapshot.ts'
import { getWebGpuDevice } from '../gpu/GpuVoxelBuffer.ts'
import {
  GpuChunkMesher,
  readGpuChunkMeshCounts,
} from '../gpu/GpuChunkMesher.ts'
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
import { createGpuIndirectDrawProfileSampler } from './createGpuIndirectDrawProfileSampler.ts'
import { createGpuVisibilityTracker } from './createGpuVisibilityTracker.ts'
import { createVoxelChunkMaterial } from './createVoxelChunkMaterial.ts'
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
import { installDebugWorldSurface } from './installDebugWorldSurface.ts'
import { createGpuMeshCompactionScheduler } from './createGpuMeshCompactionScheduler.ts'
import { loadHdrEnvironment } from './loadHdrEnvironment.ts'
import { loadVoxelTextureAtlas } from './loadVoxelTextureAtlas.ts'
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

  const renderer = new THREE.WebGPURenderer({
    antialias: true,
    trackTimestamp: true,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  viewport.append(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x04060b)
  scene.backgroundBlurriness = 0.18
  scene.backgroundIntensity = 0.45
  scene.environmentIntensity = 0.9

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 320)
  const movementSpeed = 8

  scene.add(new THREE.AmbientLight(0xf4efe4, 0.45))

  const keyLight = new THREE.DirectionalLight(0xf6d6a7, 1.7)
  keyLight.position.set(14, 18, 8)
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0x6eb7ff, 0.55)
  fillLight.position.set(-10, 8, -12)
  scene.add(fillLight)

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
  let disposeHdrEnvironment = (): void => {}
  let gpuDevice: GPUDevice | null = null
  let gpuChunkIndirectDrawCuller: GpuChunkIndirectDrawCuller | null = null
  let gpuChunkMesher: GpuChunkMesher | null = null
  let gpuChunkMeshCache: GpuChunkMeshCache | null = null
  let gpuChunkMeshSlab: GpuChunkMeshSlab | null = null
  let gpuChunkVisibilityCuller: GpuChunkVisibilityCuller | null = null
  let gpuTerrainGenerator: GpuTerrainGenerator | null = null
  let gpuVoxelCache: GpuChunkVoxelCache | null = null
  let gpuVoxelSlab: GpuVoxelSlab | null = null
  let gpuMeshStatsRefreshToken = 0
  let pendingGpuTimestampResolve: Promise<void> | null = null
  let renderFramesSinceGpuResolve = 0
  let isVoxelEditInFlight = false
  const profileRecorder = new ProfileRecorder()
  const gpuIndirectDrawProfileSampler = createGpuIndirectDrawProfileSampler({
    getCuller: () => gpuChunkIndirectDrawCuller,
    recorder: profileRecorder,
  })
  const voxelOverrideStore = new VoxelOverrideStore()

  const refreshGpuMeshStats = async (): Promise<void> => {
    if (gpuDevice === null || gpuChunkMeshCache === null) {
      return
    }

    const activeGpuDevice = gpuDevice
    const refreshToken = ++gpuMeshStatsRefreshToken
    const entries = chunkStreamer.world.entries()
    const meshCounts = await Promise.all(
      entries.map(async (entry) => {
        const handle = gpuChunkMeshCache?.getMesh(entry.coords)

        if (handle === undefined) {
          return null
        }

        return {
          counts: await readGpuChunkMeshCounts(activeGpuDevice, handle),
          key: chunkKey(entry.coords),
        }
      })
    )

    if (refreshToken !== gpuMeshStatsRefreshToken) {
      return
    }

    let nextDrawCalls = 0
    let nextFaceCount = 0
    let nextTriangleCount = 0

    for (const meshCount of meshCounts) {
      if (meshCount === null) {
        continue
      }

      const isRenderable = meshCount.counts.indexCount > 0

      nextFaceCount += meshCount.counts.faceCount
      nextTriangleCount += meshCount.counts.indexCount / 3
      nextDrawCalls += isRenderable ? 1 : 0

      const mesh = chunkMeshMap.get(meshCount.key)

      if (mesh !== undefined) {
        mesh.visible = isRenderable
      }
    }

    drawCalls = nextDrawCalls
    totalFaceCount = nextFaceCount
    totalTriangleCount = nextTriangleCount
    applyStatsToHud()
  }
  const gpuVisibilityTracker = createGpuVisibilityTracker({
    afterCull: () => gpuChunkIndirectDrawCuller?.apply(),
    getCuller: () => gpuChunkVisibilityCuller,
    onVisibilityInfoChange: () => applyStatsToHud(),
  })

  const gpuMeshCompactionScheduler = createGpuMeshCompactionScheduler({
    getMeshCache: () => gpuChunkMeshCache,
    getMeshSlab: () => gpuChunkMeshSlab,
    onAfterCompaction: () => {
      gpuVisibilityTracker.cull(camera, true)
      void refreshGpuMeshStats()
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

  const spawnX = 16
  const spawnZ = 48
  const spawnSurfaceHeight = terrainGenerator.getSurfaceHeightAt(spawnX, spawnZ)
  const flyTarget = new THREE.Vector3(spawnX, spawnSurfaceHeight + 6, 0)
  const initialPosition = new THREE.Vector3(
    spawnX,
    spawnSurfaceHeight + 18,
    spawnZ
  )
  camera.position.copy(initialPosition)
  camera.lookAt(flyTarget)
  camera.updateMatrixWorld()

  const controls = new PointerLockControls(camera, renderer.domElement)
  controls.pointerSpeed = 0.75

  const inputState = createInputState()
  const previousCameraPosition = initialPosition.clone()
  const currentCameraPosition = initialPosition.clone()

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
        gpuChunkIndirectDrawCuller !== null
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

  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('keyup', handleKeyUp)
  controls.addEventListener('lock', handleLock)
  controls.addEventListener('unlock', handleUnlock)
  lockButton.addEventListener('click', handleLockButtonClick)
  profileButton.addEventListener('click', handleProfileButtonPress)
  copyProfileButton.addEventListener('click', handleCopyProfileButtonPress)
  renderer.domElement.addEventListener('mousedown', handleViewportMouseDown)
  renderer.domElement.addEventListener('contextmenu', handleViewportContextMenu)
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
    getGpuTerrainErrorMessage: () =>
      gpuTerrainGenerator?.getLastErrorMessage() ?? null,
    getGpuVisibilityInfo: () => gpuVisibilityTracker.readInfo(),
    getGpuVoxelCache: () => gpuVoxelCache,
    getHdrEnvironmentName: () => hdrEnvironmentName,
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
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('keyup', handleKeyUp)
    controls.removeEventListener('lock', handleLock)
    controls.removeEventListener('unlock', handleUnlock)
    lockButton.removeEventListener('click', handleLockButtonClick)
    profileButton.removeEventListener('click', handleProfileButtonPress)
    copyProfileButton.removeEventListener('click', handleCopyProfileButtonPress)
    renderer.domElement.removeEventListener(
      'mousedown',
      handleViewportMouseDown
    )
    renderer.domElement.removeEventListener(
      'contextmenu',
      handleViewportContextMenu
    )
    uninstallDebugSurface()
    controls.dispose()
    disposeChunkMeshPool(chunkMeshSlotMap)
    gpuChunkMeshCache?.dispose()
    gpuChunkMeshSlab?.dispose()
    gpuChunkIndirectDrawCuller?.destroy()
    gpuChunkVisibilityCuller?.destroy()
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
    gpuDevice = getWebGpuDevice(renderer)
    gpuVoxelSlab = new GpuVoxelSlab(gpuDevice, maxRetainedChunkCount)
    gpuVoxelCache = new GpuChunkVoxelCache(
      (entry) => {
        if (gpuVoxelSlab === null) {
          throw new Error('GPU voxel slab is not ready')
        }

        return gpuVoxelSlab.allocate(entry.coords)
      },
      (handle) => {
        if (gpuVoxelSlab === null) {
          return
        }

        gpuVoxelSlab.release(handle)
      }
    )
    gpuTerrainGenerator = new GpuTerrainGenerator(gpuDevice, { seed: 'kiseki' })
    gpuChunkMesher = new GpuChunkMesher(gpuDevice)
    gpuChunkMeshSlab = new GpuChunkMeshSlab(renderer, maxRetainedChunkCount)
    gpuChunkVisibilityCuller = new GpuChunkVisibilityCuller(
      renderer,
      maxRetainedChunkCount
    )
    gpuChunkIndirectDrawCuller = new GpuChunkIndirectDrawCuller(
      gpuDevice,
      gpuChunkVisibilityCuller.getDrawState(),
      gpuChunkMeshSlab.getIndirectDrawState()
    )
    gpuChunkMeshCache = new GpuChunkMeshCache(
      (entry) => {
        if (gpuChunkMeshSlab === null) {
          throw new Error('GPU chunk mesh slab is not ready')
        }

        const handle = gpuChunkMeshSlab.allocate(entry.coords)

        gpuChunkVisibilityCuller?.registerChunk(handle, entry.coords)

        return handle
      },
      (handle) => {
        gpuChunkVisibilityCuller?.release(handle)

        if (gpuChunkMeshSlab === null) {
          return
        }

        gpuChunkMeshSlab.release(handle)
      }
    )
    statusValue.textContent = 'Loading assets'
    const [atlas, hdrEnvironment] = await Promise.all([
      loadVoxelTextureAtlas(renderer),
      loadHdrEnvironment(renderer),
    ])
    voxelChunkMaterial = createVoxelChunkMaterial(
      atlas,
      gpuChunkVisibilityCuller?.getMaterialState()
    )
    scene.background = hdrEnvironment.backgroundTexture
    scene.environment = hdrEnvironment.environmentTexture
    hdrEnvironmentName = hdrEnvironment.environmentName
    disposeHdrEnvironment = hdrEnvironment.dispose
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
