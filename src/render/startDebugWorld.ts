import * as THREE from 'three/webgpu'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import WebGPU from 'three/addons/capabilities/WebGPU.js'
import { FixedStepLoop } from '../core/FixedStepLoop.ts'
import { buildGpuPipelineInfo } from '../debug/buildGpuPipelineInfo.ts'
import type { KisekiDebugStats } from '../debug/installKisekiDebugSurface.ts'
import { getGpuAllocationSnapshot } from '../gpu/getGpuAllocationSnapshot.ts'
import type { GpuChunkMeshCache } from '../gpu/GpuChunkMeshCache.ts'
import type { GpuChunkIndirectDrawCuller } from '../gpu/GpuChunkIndirectDrawCuller.ts'
import type { GpuChunkLightCache } from '../gpu/GpuChunkLightCache.ts'
import type { GpuChunkMeshSlab } from '../gpu/GpuChunkMeshSlab.ts'
import type { GpuChunkMesher } from '../gpu/GpuChunkMesher.ts'
import type { GpuChunkOcclusionCuller } from '../gpu/GpuChunkOcclusionCuller.ts'
import type { GpuChunkSdfCache } from '../gpu/GpuChunkSdfCache.ts'
import type { GpuChunkVoxelCache } from '../gpu/GpuChunkVoxelCache.ts'
import type { GpuChunkVisibilityCuller } from '../gpu/GpuChunkVisibilityCuller.ts'
import type { GpuLightGenerator } from '../gpu/GpuLightGenerator.ts'
import type { GpuLightSlab } from '../gpu/GpuLightSlab.ts'
import type { GpuSdfGenerator } from '../gpu/GpuSdfGenerator.ts'
import type { GpuSdfSlab } from '../gpu/GpuSdfSlab.ts'
import type { GpuTerrainGenerator } from '../gpu/GpuTerrainGenerator.ts'
import type { GpuVoxelSlab } from '../gpu/GpuVoxelSlab.ts'
import {
  formatProfileReport,
  ProfileRecorder,
} from '../profiling/ProfileRecorder.ts'
import { CHUNK_SIZE, type Chunk } from '../voxel/chunk.ts'
import { advanceChunkRevealFactors } from './chunkReveal.ts'
import { createDebugChunkStreamer } from './createDebugChunkStreamer.ts'
import { createDebugHudUpdater } from './createDebugHudUpdater.ts'
import { createDebugWorldMarkup } from './createDebugWorldMarkup.ts'
import { createDebugWorldGpuRuntime } from './createDebugWorldGpuRuntime.ts'
import { createDebugWorldScene } from './createDebugWorldScene.ts'
import { createDebugFlyKeyHandlers } from './createDebugFlyKeyHandlers.ts'
import { createVoxelEditHandler } from './createVoxelEditHandler.ts'
import { createVoxelLookController } from './createVoxelLookController.ts'
import { createGpuIndirectDrawProfileSampler } from './createGpuIndirectDrawProfileSampler.ts'
import { createGpuMeshStatsRefresher } from './createGpuMeshStatsRefresher.ts'
import { createGpuOcclusionController } from './createGpuOcclusionController.ts'
import { createGpuVisibilityTracker } from './createGpuVisibilityTracker.ts'
import type { VoxelMaterialGallery } from './createVoxelMaterialGallery.ts'
import {
  createInputState,
  type DebugWorldHandle,
  disposeChunkMeshPool,
  type DisposableMesh,
  getPipelineState,
  turnCameraByDegrees,
  updatePointerHud,
} from './debugWorldHelpers.ts'
import { getDebugWorldElements } from './getDebugWorldElements.ts'
import { getDebugChunkStreamingFocusPosition } from './getDebugChunkStreamingFocusPosition.ts'
import { installDebugWorldEventHandlers } from './installDebugWorldEventHandlers.ts'
import { installDebugWorldSurface } from './installDebugWorldSurface.ts'
import { createGpuMeshCompactionScheduler } from './createGpuMeshCompactionScheduler.ts'
import { setupInitialCameraPose } from './setupInitialCameraPose.ts'
import { syncStreamedGpuLightBuffers } from './syncStreamedGpuLightBuffers.ts'
import { syncStreamedGpuSdfBuffers } from './syncStreamedGpuSdfBuffers.ts'
import {
  syncStreamedGpuChunkMeshes,
  type SyncStreamedGpuChunkMeshesResult,
} from './syncStreamedGpuChunkMeshes.ts'
import { syncStreamedGpuVoxelBuffers } from './syncStreamedGpuVoxelBuffers.ts'
import {
  type ChunkStreamUpdate,
  worldPositionToChunkCoordinates,
} from '../world/ChunkStreamer.ts'
import { VoxelOverrideStore } from '../world/VoxelOverrideStore.ts'
import { TerrainGenerator } from '../world/TerrainGenerator.ts'
import { advanceDebugWorldCamera } from './advanceDebugWorldCamera.ts'
import * as pfw from './profileFrameWork.ts'

const CHUNK_STREAMING_LEAD_DISTANCE = CHUNK_SIZE * 2
const GPU_TIMESTAMP_QUERY_PARAM = 'gpu-timestamps'

export async function startDebugWorld(
  root: HTMLElement
): Promise<DebugWorldHandle> {
  root.innerHTML = createDebugWorldMarkup()
  const debugWorldElements = getDebugWorldElements(root)
  const {
    copyProfileButton,
    fixedRateValue,
    lockButton,
    pointerStateValue,
    profileButton,
    statusValue,
    viewport,
  } = debugWorldElements

  if (!WebGPU.isAvailable()) {
    statusValue.textContent = 'WebGPU unavailable'
    viewport.append(WebGPU.getErrorMessage())
    return () => {
      root.innerHTML = ''
    }
  }

  const shouldTrackGpuTimestamps = new URLSearchParams(
    window.location.search
  ).has(GPU_TIMESTAMP_QUERY_PARAM)
  const { camera, canvas, lightingRig, renderer, scene } =
    createDebugWorldScene(viewport, {
      trackGpuTimestamps: shouldTrackGpuTimestamps,
    })

  const terrainGenerator = new TerrainGenerator({ seed: 'kiseki' })
  const chunkStreamer = createDebugChunkStreamer()
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
  let lastLightGenerationTimeMs = 0
  let lastMeshGenerationTimeMs = 0
  let lastSdfGenerationTimeMs = 0
  let lastTerrainGenerationTimeMs = 0
  let hdrEnvironmentName: string | null = null
  let voxelChunkMaterial: THREE.MeshStandardNodeMaterial | null = null
  let voxelMaterialGallery: VoxelMaterialGallery | null = null
  const voxelLookController = createVoxelLookController({
    lightingRig,
    renderer,
    root,
    scene,
  })
  let disposeHdrEnvironment = (): void => {}
  let gpuDevice: GPUDevice | null = null
  let gpuChunkIndirectDrawCuller: GpuChunkIndirectDrawCuller | null = null
  let gpuChunkLightCache: GpuChunkLightCache | null = null
  let gpuChunkMesher: GpuChunkMesher | null = null
  let gpuChunkMeshCache: GpuChunkMeshCache | null = null
  let gpuChunkMeshSlab: GpuChunkMeshSlab | null = null
  let gpuChunkOcclusionCuller: GpuChunkOcclusionCuller | null = null
  let gpuChunkSdfCache: GpuChunkSdfCache | null = null
  let gpuChunkVisibilityCuller: GpuChunkVisibilityCuller | null = null
  let gpuLightGenerator: GpuLightGenerator | null = null
  let gpuLightSlab: GpuLightSlab | null = null
  let gpuSdfGenerator: GpuSdfGenerator | null = null
  let gpuSdfSlab: GpuSdfSlab | null = null
  let gpuTerrainGenerator: GpuTerrainGenerator | null = null
  let gpuVoxelCache: GpuChunkVoxelCache | null = null
  let gpuVoxelSlab: GpuVoxelSlab | null = null
  let pendingGpuTimestampResolve: Promise<void> | null = null
  let renderFramesSinceGpuResolve = 0
  const profileRecorder = new ProfileRecorder()
  let pendingProfileFrameWork = pfw.createProfileFrameWork()
  const gpuIndirectDrawProfileSampler = createGpuIndirectDrawProfileSampler({
    getCuller: () => gpuChunkIndirectDrawCuller,
    getOcclusionCuller: () => gpuChunkOcclusionCuller,
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
    encodeAfterCull: (encoder) =>
      gpuChunkIndirectDrawCuller?.encodeApply(encoder),
    beforeCull: () => gpuOcclusionController.cullIfNeeded(),
    getCuller: () => gpuChunkVisibilityCuller,
    onVisibilityInfoChange: () => applyStatsToHud(),
    refreshEveryFrames: null,
  })

  const gpuMeshCompactionScheduler = createGpuMeshCompactionScheduler({
    delayMs: 600,
    getMeshCache: () => gpuChunkMeshCache,
    getMeshSlab: () => gpuChunkMeshSlab,
    onAfterCompaction: () => {
      gpuVisibilityTracker.cull(camera, true)
      void gpuMeshStatsRefresher.refresh()
    },
  })

  const syncGpuChunkMeshes = (
    update: Pick<ChunkStreamUpdate, 'loaded' | 'unloaded'>,
    encoder?: GPUCommandEncoder
  ): SyncStreamedGpuChunkMeshesResult | null => {
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
      return null
    }

    const result = syncStreamedGpuChunkMeshes({
      chunkMeshCache: activeGpuChunkMeshCache,
      chunkMeshSlotMap,
      chunkMesher: activeGpuChunkMesher,
      chunkMeshMap,
      encoder,
      getLightSlotIndex: (coords) =>
        gpuChunkLightCache?.getBuffer(coords)?.slotIndex ?? null,
      getSdfSlotIndex: (coords) =>
        gpuChunkSdfCache?.getBuffer(coords)?.slotIndex ?? null,
      gpuVoxelCache: activeGpuVoxelCache,
      material: activeMaterial,
      update,
      worldGroup,
      worldHasChunk: (coords) => chunkStreamer.world.hasChunk(coords),
    })

    chunkMeshes = result.chunkMeshes
    lastMeshGenerationTimeMs = result.meshGenerationTimeMs
    pfw.addProfileMeshWork(pendingProfileFrameWork, result)
    gpuOcclusionController.syncGraph()

    if (result.remeshedChunkCount > 0) {
      profileRecorder.recordMeshGeneration(
        lastMeshGenerationTimeMs,
        result.remeshedChunkCount
      )
    }

    return result
  }

  const syncStreamedWorld = (position: THREE.Vector3): ChunkStreamUpdate => {
    const streamUpdate = chunkStreamer.updateFromWorldPosition(position)

    if (streamUpdate.didChange) {
      const activeGpuDevice = gpuDevice
      const gpuAdmissionEncoder =
        activeGpuDevice !== null && streamUpdate.loaded.length <= 1
          ? activeGpuDevice.createCommandEncoder({
              label: 'chunk_stream_admission_encoder',
            })
          : undefined

      pfw.addProfileStreamWork(pendingProfileFrameWork, streamUpdate)

      const voxelSyncResult = syncStreamedGpuVoxelBuffers({
        encoder: gpuAdmissionEncoder,
        gpuTerrainGenerator,
        gpuVoxelCache,
        update: streamUpdate,
      })
      lastTerrainGenerationTimeMs = voxelSyncResult.terrainGenerationTimeMs
      pfw.addProfileTerrainWork(pendingProfileFrameWork, voxelSyncResult)

      if (voxelSyncResult.generatedChunkCount > 0) {
        profileRecorder.recordTerrainGeneration(
          lastTerrainGenerationTimeMs,
          voxelSyncResult.generatedChunkCount
        )
      }

      const sdfSyncResult = syncStreamedGpuSdfBuffers({
        encoder: gpuAdmissionEncoder,
        gpuSdfCache: gpuChunkSdfCache,
        gpuSdfGenerator,
        gpuVoxelCache,
        update: streamUpdate,
      })
      lastSdfGenerationTimeMs = sdfSyncResult.sdfGenerationTimeMs
      pfw.addProfileSdfWork(pendingProfileFrameWork, sdfSyncResult)

      if (sdfSyncResult.generatedChunkCount > 0) {
        profileRecorder.recordSdfGeneration(
          lastSdfGenerationTimeMs,
          sdfSyncResult.generatedChunkCount
        )
      }

      const lightSyncResult = syncStreamedGpuLightBuffers({
        encoder: gpuAdmissionEncoder,
        gpuLightCache: gpuChunkLightCache,
        gpuLightGenerator,
        gpuVoxelCache,
        update: streamUpdate,
      })
      lastLightGenerationTimeMs = lightSyncResult.lightGenerationTimeMs
      pfw.addProfileLightWork(pendingProfileFrameWork, lightSyncResult)

      if (lightSyncResult.generatedChunkCount > 0) {
        profileRecorder.recordLightGeneration(
          lastLightGenerationTimeMs,
          lightSyncResult.generatedChunkCount
        )
      }

      const meshSyncResult = syncGpuChunkMeshes(
        streamUpdate,
        gpuAdmissionEncoder
      )
      const gpuAdmissionComputePassCount =
        voxelSyncResult.gpuComputePassCount +
        sdfSyncResult.gpuComputePassCount +
        lightSyncResult.gpuComputePassCount +
        (meshSyncResult?.gpuComputePassCount ?? 0)

      if (
        activeGpuDevice !== null &&
        gpuAdmissionEncoder !== undefined &&
        gpuAdmissionComputePassCount > 0
      ) {
        activeGpuDevice.queue.submit([gpuAdmissionEncoder.finish()])
        pfw.addProfileGpuStreamSubmissionWork(pendingProfileFrameWork, 1)
      }

      gpuMeshCompactionScheduler.schedule()
    }

    applyStatsToHud()

    return streamUpdate
  }

  const initialPosition = setupInitialCameraPose(camera, terrainGenerator)

  const controls = new PointerLockControls(camera, canvas)
  controls.pointerSpeed = 0.75

  const inputState = createInputState()
  const currentCameraPosition = initialPosition.clone()
  const streamingFocusPosition = initialPosition.clone()

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
    getGpuAllocationSnapshot(
      gpuChunkMeshSlab,
      gpuVoxelSlab,
      gpuSdfSlab,
      gpuLightSlab
    )

  const applyStatsToHud = createDebugHudUpdater({
    buildStatsSnapshot,
    elements: debugWorldElements,
    profileRecorder,
  })

  let wasPointerLocked: boolean | null = null
  const updatePointerState = (): void => {
    if (wasPointerLocked === controls.isLocked) {
      return
    }

    wasPointerLocked = controls.isLocked
    updatePointerHud(controls.isLocked, lockButton, pointerStateValue)
  }

  const resolveGpuTimestampIfNeeded = (): void => {
    if (
      !shouldTrackGpuTimestamps ||
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
    if (!shouldTrackGpuTimestamps) {
      return
    }

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

  const { handleKeyDown, handleKeyUp } = createDebugFlyKeyHandlers(inputState)
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
        applyStatsToHud(performance.now(), true)
      }
      return
    }

    pendingProfileFrameWork = pfw.createProfileFrameWork()
    profileRecorder.start(performance.now(), captureGpuAllocationSnapshot())
    applyStatsToHud(performance.now(), true)
  }
  const handleCopyProfileButtonClick = async (): Promise<void> => {
    const report = profileRecorder.getLastReport()

    if (report === null) {
      return
    }

    await navigator.clipboard.writeText(formatProfileReport(report))
  }
  const handleVoxelEdit = createVoxelEditHandler({
    camera,
    chunkStreamer,
    controls,
    getGpuChunkLightCache: () => gpuChunkLightCache,
    getGpuChunkMeshCache: () => gpuChunkMeshCache,
    getGpuChunkMesher: () => gpuChunkMesher,
    getGpuChunkSdfCache: () => gpuChunkSdfCache,
    getGpuChunkVoxelCache: () => gpuVoxelCache,
    getGpuDevice: () => gpuDevice,
    getGpuLightGenerator: () => gpuLightGenerator,
    getGpuSdfGenerator: () => gpuSdfGenerator,
    onAfterEditAttempt: () => applyStatsToHud(performance.now(), true),
    onWorldEdited: () => {
      gpuOcclusionController.syncGraph()
      gpuVisibilityTracker.cull(camera, true)
      gpuMeshCompactionScheduler.schedule()
    },
    overrideStore: voxelOverrideStore,
    statusValue,
  })
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
  applyStatsToHud(performance.now(), true)
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
    getGpuLightCache: () => gpuChunkLightCache,
    getGpuLightGenerator: () => gpuLightGenerator,
    getGpuMeshCompactionInfo: () =>
      gpuChunkMeshSlab?.getCompactionInfo() ?? null,
    getGpuOcclusionInfo: async () =>
      gpuChunkOcclusionCuller === null
        ? null
        : await gpuChunkOcclusionCuller.readInfo(),
    getGpuSdfCache: () => gpuChunkSdfCache,
    getGpuSdfGenerator: () => gpuSdfGenerator,
    getGpuTerrainErrorMessage: () =>
      gpuTerrainGenerator?.getLastErrorMessage() ?? null,
    getGpuVisibilityInfo: () => gpuVisibilityTracker.readInfo(),
    getGpuVoxelCache: () => gpuVoxelCache,
    getHdrEnvironmentName: () => hdrEnvironmentName,
    getMaterialGalleryInfo: () => voxelMaterialGallery?.info() ?? null,
    getProfileReport: () => profileRecorder.getLastReport(),
    getProfileState: () => profileRecorder.getSessionState(performance.now()),
    getScene: () => scene,
    getVoxelLook: voxelLookController.getInfo,
    placeTargetBlock: async () => handleVoxelEdit('place', false),
    setCameraPosition: (x: number, y: number, z: number): void => {
      currentCameraPosition.set(x, y, z)
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
    setVoxelLook: voxelLookController.setSettings,
    setVoxelLookPreset: voxelLookController.setPreset,
    startProfileSession: (): void => {
      pendingProfileFrameWork = pfw.createProfileFrameWork()
      profileRecorder.start(performance.now(), captureGpuAllocationSnapshot())
      applyStatsToHud(performance.now(), true)
    },
    stopProfileSession: async () => {
      await flushGpuTimestamp()
      await gpuIndirectDrawProfileSampler.flush()
      const report = profileRecorder.stop(
        performance.now(),
        captureGpuAllocationSnapshot()
      )
      applyStatsToHud(performance.now(), true)
      return report
    },
    syncWorld: (): void => {
      syncStreamedWorld(currentCameraPosition)
      gpuVisibilityTracker.cull(camera, true)
    },
    turnCamera: (yawDegrees: number, pitchDegrees = 0): void => {
      turnCameraByDegrees(camera, yawDegrees, pitchDegrees)
      gpuVisibilityTracker.cull(camera, true)
      applyStatsToHud(performance.now(), true)
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
    voxelLookController.disposeControls()
    controls.dispose()
    disposeChunkMeshPool(chunkMeshSlotMap)
    gpuChunkMeshCache?.dispose()
    gpuChunkMeshSlab?.dispose()
    gpuChunkLightCache?.dispose()
    gpuChunkIndirectDrawCuller?.destroy()
    gpuChunkOcclusionCuller?.destroy()
    gpuChunkSdfCache?.dispose()
    gpuChunkVisibilityCuller?.destroy()
    voxelMaterialGallery?.dispose()
    gpuChunkMesher?.destroy()
    gpuLightGenerator?.destroy()
    gpuLightSlab?.dispose()
    gpuSdfGenerator?.destroy()
    gpuSdfSlab?.dispose()
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
      materialLookUniforms: voxelLookController.materialUniforms,
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
    gpuChunkLightCache = gpuRuntime.gpuChunkLightCache
    gpuChunkSdfCache = gpuRuntime.gpuChunkSdfCache
    gpuChunkIndirectDrawCuller = gpuRuntime.gpuChunkIndirectDrawCuller
    gpuChunkMeshCache = gpuRuntime.gpuChunkMeshCache
    gpuLightGenerator = gpuRuntime.gpuLightGenerator
    gpuLightSlab = gpuRuntime.gpuLightSlab
    gpuSdfGenerator = gpuRuntime.gpuSdfGenerator
    gpuSdfSlab = gpuRuntime.gpuSdfSlab
    voxelChunkMaterial = gpuRuntime.voxelChunkMaterial
    voxelMaterialGallery = gpuRuntime.voxelMaterialGallery
    hdrEnvironmentName = gpuRuntime.hdrEnvironmentName
    disposeHdrEnvironment = gpuRuntime.disposeHdrEnvironment
    voxelLookController.applyDefaultPreset()
    voxelLookController.installControls()
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

  let previousPostRenderStreamCpuTimeMs = 0
  let previousPostRenderStreamedInChunkCount = 0
  let previousPostRenderStreamedOutChunkCount = 0

  void renderer.setAnimationLoop((timestampMilliseconds?: number) => {
    const frameStartMs = performance.now()
    const timestampSeconds = (timestampMilliseconds ?? 0) / 1000
    const frame = fixedLoop.advance(timestampSeconds)
    const instantaneousFps =
      frame.frameTimeSeconds > 0 ? 1 / frame.frameTimeSeconds : smoothedFps

    if (frame.frameTimeSeconds > 0) {
      smoothedFps = THREE.MathUtils.lerp(smoothedFps, instantaneousFps, 0.15)
    }

    advanceDebugWorldCamera({
      camera,
      controls,
      currentCameraPosition,
      frameTimeSeconds: frame.frameTimeSeconds,
      inputState,
      maxMovementDeltaSeconds: 1 / 30,
      movementSpeed: 8,
    })

    advanceChunkRevealFactors(chunkMeshes, frame.frameTimeSeconds)
    updatePointerState()
    gpuVisibilityTracker.cull(camera)
    voxelMaterialGallery?.syncToCamera(camera)

    const renderSubmitStartMs = performance.now()

    void renderer.render(scene, camera)

    const renderSubmitCpuTimeMs = performance.now() - renderSubmitStartMs
    const postRenderStreamStartMs = performance.now()

    // Stream after submitting the current frame so chunk admission work cannot
    // sit directly in front of the frame the player is trying to see.
    const streamUpdate = syncStreamedWorld(
      getDebugChunkStreamingFocusPosition({
        camera,
        inputState,
        leadDistance: CHUNK_STREAMING_LEAD_DISTANCE,
        position: currentCameraPosition,
        target: streamingFocusPosition,
      })
    )
    const postRenderStreamCpuTimeMs =
      performance.now() - postRenderStreamStartMs
    const preRenderCpuTimeMs = renderSubmitStartMs - frameStartMs

    if (frame.frameTimeSeconds > 0) {
      gpuIndirectDrawProfileSampler.tick()
    }

    renderFramesSinceGpuResolve += 1
    resolveGpuTimestampIfNeeded()
    applyStatsToHud()

    lastCpuFrameTimeMs = performance.now() - frameStartMs

    if (frame.frameTimeSeconds > 0) {
      pendingProfileFrameWork = pfw.recordProfileFrame({
        fixedStepCount: frame.steps,
        frameTimeSeconds: frame.frameTimeSeconds,
        frameWork: pendingProfileFrameWork,
        gpuMemoryBytes: renderer.info.memory.total,
        gpuTimeMs: lastGpuFrameTimeMs,
        pendingStreamLoadCount: chunkStreamer.getPendingLoadCount(),
        postRenderStreamCpuTimeMs,
        preRenderCpuTimeMs,
        previousPostRenderStreamCpuTimeMs,
        previousPostRenderStreamedInChunkCount,
        previousPostRenderStreamedOutChunkCount,
        renderSubmitCpuTimeMs,
        recorder: profileRecorder,
        stats: buildStatsSnapshot(),
      })
    }

    previousPostRenderStreamCpuTimeMs = postRenderStreamCpuTimeMs
    previousPostRenderStreamedInChunkCount = streamUpdate.loaded.length
    previousPostRenderStreamedOutChunkCount = streamUpdate.unloaded.length
  })

  return () => {
    disposeRuntime()
    root.innerHTML = ''
  }
}
