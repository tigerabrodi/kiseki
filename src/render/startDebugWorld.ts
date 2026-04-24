import * as THREE from 'three/webgpu'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import WebGPU from 'three/addons/capabilities/WebGPU.js'

import { getFlyMovementIntent } from '../camera/getFlyMovementIntent.ts'
import { FixedStepLoop } from '../core/FixedStepLoop.ts'
import { buildGpuPipelineInfo } from '../debug/buildGpuPipelineInfo.ts'
import type { KisekiDebugStats } from '../debug/installKisekiDebugSurface.ts'
import { GpuChunkMeshCache } from '../gpu/GpuChunkMeshCache.ts'
import { createGpuChunkMeshCache } from '../gpu/createGpuChunkMeshCache.ts'
import { createRendererBackedGpuChunkMeshHandle } from '../gpu/createRendererBackedGpuChunkMeshHandle.ts'
import { GpuTerrainGenerator } from '../gpu/GpuTerrainGenerator.ts'
import { GpuChunkVoxelCache } from '../gpu/GpuChunkVoxelCache.ts'
import {
  createEmptyGpuVoxelBuffer,
  destroyGpuVoxelBuffer,
  getWebGpuDevice,
} from '../gpu/GpuVoxelBuffer.ts'
import {
  GpuChunkMesher,
  readGpuChunkMeshCounts,
} from '../gpu/GpuChunkMesher.ts'
import {
  applyVoxelEdit,
  type VoxelEditMode,
} from '../interaction/applyVoxelEdit.ts'
import {
  ProfileRecorder,
  formatProfileReport,
} from '../profiling/ProfileRecorder.ts'
import { Chunk } from '../voxel/chunk.ts'
import { createDebugWorldMarkup } from './createDebugWorldMarkup.ts'
import { createGpuChunkRenderMesh } from './createGpuChunkRenderMesh.ts'
import { createVoxelChunkMaterial } from './createVoxelChunkMaterial.ts'
import {
  bytesToMegabytes,
  createInputState,
  disposeMeshGeometries,
  getJsHeapBytes,
  turnCameraByDegrees,
} from './debugWorldHelpers.ts'
import { getDebugWorldElements } from './getDebugWorldElements.ts'
import { installDebugWorldSurface } from './installDebugWorldSurface.ts'
import { countVisibleChunkMeshes } from './countVisibleChunkMeshes.ts'
import { loadHdrEnvironment } from './loadHdrEnvironment.ts'
import { loadVoxelTextureAtlas } from './loadVoxelTextureAtlas.ts'
import {
  type ChunkStreamUpdate,
  ChunkStreamer,
  worldPositionToChunkCoordinates,
} from '../world/ChunkStreamer.ts'
import { VoxelOverrideStore } from '../world/VoxelOverrideStore.ts'
import { chunkKey, chunkOrigin } from '../world/World.ts'
import { TerrainGenerator } from '../world/TerrainGenerator.ts'

type DebugWorldHandle = () => void
type DisposableMesh = THREE.Mesh<
  THREE.BufferGeometry,
  THREE.Material | Array<THREE.Material>
>

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
  let worldGroup = new THREE.Group()
  scene.add(worldGroup)
  let chunkMeshes: Array<DisposableMesh> = []
  let chunkMeshMap = new Map<string, DisposableMesh>()
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
  let gpuChunkMesher: GpuChunkMesher | null = null
  let gpuChunkMeshCache: GpuChunkMeshCache | null = null
  let gpuTerrainGenerator: GpuTerrainGenerator | null = null
  let gpuVoxelCache: GpuChunkVoxelCache | null = null
  let gpuMeshStatsRefreshToken = 0
  let pendingGpuTimestampResolve: Promise<void> | null = null
  let renderFramesSinceGpuResolve = 0
  let isVoxelEditInFlight = false
  const profileRecorder = new ProfileRecorder()
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

  const rebuildWorldMeshes = (): void => {
    const rebuildStartMs = performance.now()
    const activeMaterial = voxelChunkMaterial
    const activeGpuChunkMeshCache = gpuChunkMeshCache

    scene.remove(worldGroup)
    disposeMeshGeometries(worldGroup)
    chunkMeshMap = new Map()

    if (activeMaterial === null || activeGpuChunkMeshCache === null) {
      return
    }

    activeGpuChunkMeshCache.rebuild(chunkStreamer.world.entries())

    const nextWorldGroup = new THREE.Group()
    const nextChunkMeshes: Array<DisposableMesh> = []

    for (const entry of chunkStreamer.world.entries()) {
      const chunkHandle = activeGpuChunkMeshCache.getMesh(entry.coords)

      if (chunkHandle === undefined) {
        continue
      }

      const chunkMesh = createGpuChunkRenderMesh(chunkHandle, activeMaterial)
      const origin = chunkOrigin(entry.coords)

      chunkMesh.mesh.position.set(origin.x, origin.y, origin.z)
      nextWorldGroup.add(chunkMesh.mesh)
      nextChunkMeshes.push(chunkMesh.mesh)
      chunkMeshMap.set(chunkKey(entry.coords), chunkMesh.mesh)
    }

    worldGroup = nextWorldGroup
    chunkMeshes = nextChunkMeshes
    scene.add(worldGroup)
    worldGroup.updateMatrixWorld(true)
    lastMeshGenerationTimeMs = performance.now() - rebuildStartMs
    profileRecorder.recordMeshGeneration(
      lastMeshGenerationTimeMs,
      chunkStreamer.world.size()
    )
    void refreshGpuMeshStats()
  }

  const createReferenceChunk = (coords: {
    x: number
    y: number
    z: number
  }): Chunk =>
    voxelOverrideStore.applyToChunk(
      coords,
      terrainGenerator.createChunk(coords)
    )

  const buildPipelineInfo = () =>
    buildGpuPipelineInfo({
      chunkEntries: chunkStreamer.world.entries(),
      gpuMeshBufferCount: gpuChunkMeshCache?.size() ?? 0,
      gpuVoxelBufferCount: gpuVoxelCache?.size() ?? 0,
      overrideChunkCount: voxelOverrideStore.chunkCount(),
      overrideVoxelCount: voxelOverrideStore.voxelCount(),
      usesGpuMeshGeneration: gpuChunkMesher !== null,
      usesGpuMeshRendering: voxelChunkMaterial !== null,
      usesGpuTerrainGeneration: gpuTerrainGenerator !== null,
    })

  const syncGpuVoxelBuffers = (
    update: Pick<ChunkStreamUpdate, 'loaded' | 'unloaded'>
  ): void => {
    const terrainGenerationStartMs = performance.now()

    gpuVoxelCache?.sync(update)

    if (gpuTerrainGenerator === null || gpuVoxelCache === null) {
      return
    }

    for (const entry of update.loaded) {
      const voxelHandle = gpuVoxelCache.getBuffer(entry.coords)

      if (voxelHandle !== undefined) {
        gpuTerrainGenerator.generateChunk(voxelHandle, entry.coords)
      }
    }

    lastTerrainGenerationTimeMs = performance.now() - terrainGenerationStartMs

    if (update.loaded.length > 0) {
      profileRecorder.recordTerrainGeneration(
        lastTerrainGenerationTimeMs,
        update.loaded.length
      )
    }
  }

  const syncStreamedWorld = (position: THREE.Vector3): void => {
    const streamUpdate = chunkStreamer.updateFromWorldPosition(position)

    if (streamUpdate.didChange) {
      syncGpuVoxelBuffers(streamUpdate)
      rebuildWorldMeshes()
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
      gpuMeshBufferBytes: gpuChunkMeshCache?.totalBytes() ?? 0,
      gpuMeshBufferCount,
      gpuVoxelBufferBytes: gpuVoxelCache?.totalBytes() ?? 0,
      gpuVoxelBufferCount,
      gpuTimeMs: lastGpuFrameTimeMs,
      loadedChunkCount,
      meshGenerationTimeMs: lastMeshGenerationTimeMs,
      pipelineState: hasGpuFullPipeline ? 'GPU Full' : 'Mixed',
      playerChunk,
      position: {
        x: currentCameraPosition.x,
        y: currentCameraPosition.y,
        z: currentCameraPosition.z,
      },
      terrainGenerationTimeMs: lastTerrainGenerationTimeMs,
      triangleCount: totalTriangleCount,
      vertexBytesPerVertex: 4,
      visibleChunkCount: countVisibleChunkMeshes(camera, chunkMeshes),
    }
  }

  const applyProfileHud = (): void => {
    const profileState = profileRecorder.getSessionState(performance.now())
    let profileLabel = 'Ready'

    if (profileState.isRecording) {
      profileLabel = `Rec ${profileState.elapsedSeconds.toFixed(1)}s`
    } else if (profileState.lastReport === null) {
      profileLabel = 'Idle'
    }

    profileStateValue.textContent = profileLabel

    profileButton.textContent = profileState.isRecording
      ? 'Stop & Save Checkpoint'
      : 'Start Profile Run'
    copyProfileButton.disabled =
      profileState.isRecording || profileState.lastReport === null

    if (profileState.isRecording) {
      profileReportValue.textContent = [
        'Recording checkpoint 3...',
        `Elapsed: ${profileState.elapsedSeconds.toFixed(1)} s`,
        'Fly around, stream some chunks, try break/place, then stop to save the checkpoint.',
      ].join('\n')
      return
    }

    if (profileState.lastReport !== null) {
      profileReportValue.textContent = formatProfileReport(
        profileState.lastReport
      )
      return
    }

    profileReportValue.textContent =
      'Press Start Profile Run, fly around for a bit, try block edits, then stop to capture a fresh checkpoint-3 report.'
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
    applyProfileHud()
  }

  const updatePointerState = (): void => {
    pointerStateValue.textContent = controls.isLocked ? 'Locked' : 'Unlocked'
    lockButton.textContent = controls.isLocked
      ? 'Press Esc To Release'
      : 'Click To Fly'
  }

  const resolveGpuTimestampIfNeeded = (): void => {
    if (
      !profileRecorder.isRecording() ||
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
          profileRecorder.recordGpuTime(timestampMs)
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
  const handleLock = (): void => {
    updatePointerState()
  }
  const handleUnlock = (): void => {
    updatePointerState()
  }
  const handleLockButtonClick = (): void => {
    if (!controls.isLocked) {
      controls.lock(true)
    }
  }
  const handleProfileButtonPress = (): void => {
    void handleProfileButtonClick()
  }
  const handleCopyProfileButtonPress = (): void => {
    void handleCopyProfileButtonClick()
  }
  const handleProfileButtonClick = async (): Promise<void> => {
    if (profileRecorder.isRecording()) {
      profileButton.disabled = true
      try {
        await flushGpuTimestamp()
        profileRecorder.stop(performance.now())
      } finally {
        profileButton.disabled = false
        applyStatsToHud()
      }
      return
    }

    profileRecorder.start(performance.now())
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
        void refreshGpuMeshStats()
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
    buildPipelineInfo,
    buildStatsSnapshot,
    camera,
    chunkMeshes: () => chunkMeshes,
    chunkStreamer,
    createReferenceChunk,
    getGpuChunkMeshCache: () => gpuChunkMeshCache,
    getGpuDevice: () => gpuDevice,
    getGpuTerrainErrorMessage: () =>
      gpuTerrainGenerator?.getLastErrorMessage() ?? null,
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
    },
    startProfileSession: (): void => {
      profileRecorder.start(performance.now())
      applyStatsToHud()
    },
    stopProfileSession: async () => {
      await flushGpuTimestamp()
      const report = profileRecorder.stop(performance.now())
      applyStatsToHud()
      return report
    },
    syncWorld: (): void => {
      syncStreamedWorld(currentCameraPosition)
    },
    turnCamera: (yawDegrees: number, pitchDegrees = 0): void => {
      turnCameraByDegrees(camera, yawDegrees, pitchDegrees)
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

  window.addEventListener('resize', resize)
  resize()

  try {
    await renderer.init()
    gpuDevice = getWebGpuDevice(renderer)
    gpuVoxelCache = new GpuChunkVoxelCache((entry) => {
      if (gpuDevice === null) {
        throw new Error('GPU voxel cache needs an initialized WebGPU device')
      }

      return createEmptyGpuVoxelBuffer(gpuDevice, entry.coords)
    }, destroyGpuVoxelBuffer)
    gpuTerrainGenerator = new GpuTerrainGenerator(gpuDevice, { seed: 'kiseki' })
    gpuChunkMesher = new GpuChunkMesher(gpuDevice)
    gpuChunkMeshCache = createGpuChunkMeshCache(
      gpuChunkMesher,
      gpuVoxelCache,
      (entry) => createRendererBackedGpuChunkMeshHandle(renderer, entry.coords)
    )
    statusValue.textContent = 'Loading assets'
    const [atlas, hdrEnvironment] = await Promise.all([
      loadVoxelTextureAtlas(renderer),
      loadHdrEnvironment(renderer),
    ])
    voxelChunkMaterial = createVoxelChunkMaterial(atlas)
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
    gpuChunkMeshCache?.dispose()
    gpuChunkMesher?.destroy()
    gpuTerrainGenerator?.destroy()
    gpuVoxelCache?.dispose()
    disposeHdrEnvironment()
    voxelChunkMaterial?.dispose()
    void renderer.dispose()

    return () => {
      root.innerHTML = ''
    }
  }

  syncStreamedWorld(initialPosition)

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
    }

    if (profileRecorder.isRecording()) {
      renderFramesSinceGpuResolve += 1
      resolveGpuTimestampIfNeeded()
    } else {
      renderFramesSinceGpuResolve = 0
    }

    applyStatsToHud()
  })

  return () => {
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
    disposeMeshGeometries(worldGroup)
    gpuChunkMeshCache?.dispose()
    gpuChunkMesher?.destroy()
    gpuTerrainGenerator?.destroy()
    gpuVoxelCache?.dispose()
    disposeHdrEnvironment()
    voxelChunkMaterial?.dispose()
    void renderer.dispose()
    root.innerHTML = ''
  }
}
