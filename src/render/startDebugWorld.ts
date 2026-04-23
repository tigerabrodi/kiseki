import * as THREE from 'three/webgpu'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import WebGPU from 'three/addons/capabilities/WebGPU.js'

import {
  getFlyMovementIntent,
  type FlyInputState,
} from '../camera/getFlyMovementIntent.ts'
import { FixedStepLoop } from '../core/FixedStepLoop.ts'
import {
  installKisekiDebugSurface,
  type KisekiDebugStats,
} from '../debug/installKisekiDebugSurface.ts'
import { createChunkMesh } from '../mesh/createChunkMesh.ts'
import { createVoxelChunkMaterial } from './createVoxelChunkMaterial.ts'
import { countVisibleChunkMeshes } from './countVisibleChunkMeshes.ts'
import { loadVoxelTextureAtlas } from './loadVoxelTextureAtlas.ts'
import {
  ChunkStreamer,
  worldPositionToChunkCoordinates,
} from '../world/ChunkStreamer.ts'
import { chunkKey, chunkOrigin } from '../world/World.ts'
import { TerrainGenerator } from '../world/TerrainGenerator.ts'

type DebugWorldHandle = () => void
type DisposableMesh = THREE.Mesh<
  THREE.BufferGeometry,
  THREE.Material | Array<THREE.Material>
>

function createInputState(): FlyInputState {
  return {
    backward: false,
    down: false,
    forward: false,
    left: false,
    right: false,
    up: false,
  }
}

function isDisposableMesh(object: THREE.Object3D): object is DisposableMesh {
  return object instanceof THREE.Mesh
}

function disposeMeshGeometries(root: THREE.Object3D): void {
  root.traverse((child: THREE.Object3D) => {
    if (!isDisposableMesh(child)) {
      return
    }

    child.geometry.dispose()
  })
}

function turnCameraByDegrees(
  camera: THREE.PerspectiveCamera,
  yawDegrees: number,
  pitchDegrees = 0
): void {
  const rotation = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ')
  const maxPitchRadians = Math.PI / 2 - 0.01

  rotation.y += THREE.MathUtils.degToRad(yawDegrees)
  rotation.x = THREE.MathUtils.clamp(
    rotation.x + THREE.MathUtils.degToRad(pitchDegrees),
    -maxPitchRadians,
    maxPitchRadians
  )

  camera.quaternion.setFromEuler(rotation)
  camera.updateMatrixWorld()
}

export async function startDebugWorld(
  root: HTMLElement
): Promise<DebugWorldHandle> {
  root.innerHTML = `
    <main class="app-shell">
      <div class="hud">
        <p class="eyebrow">Kiseki / Step 14</p>
        <h1 class="title">Texture Arrays And Packed Vertices</h1>
        <p class="subtitle">
          Greedy quads now stream through a single packed Uint32 vertex path, while the shader samples layered KTX2 materials directly on the GPU.
        </p>
        <dl class="stats">
          <div class="stats-card">
            <dt>Status</dt>
            <dd data-status>Checking WebGPU</dd>
          </div>
          <div class="stats-card">
            <dt>Pointer</dt>
            <dd data-pointer-state>Unlocked</dd>
          </div>
          <div class="stats-card">
            <dt>Fixed Hz</dt>
            <dd data-fixed-rate>60</dd>
          </div>
          <div class="stats-card">
            <dt>FPS</dt>
            <dd data-fps>0.0</dd>
          </div>
          <div class="stats-card">
            <dt>Vertex Bytes</dt>
            <dd data-vertex-bytes>4</dd>
          </div>
          <div class="stats-card">
            <dt>Chunks</dt>
            <dd data-chunk-count>0</dd>
          </div>
          <div class="stats-card">
            <dt>Player Chunk</dt>
            <dd data-player-chunk>0,0,0</dd>
          </div>
          <div class="stats-card">
            <dt>Visible Chunks</dt>
            <dd data-visible-chunks>0</dd>
          </div>
          <div class="stats-card">
            <dt>Position</dt>
            <dd data-position>0, 0, 0</dd>
          </div>
          <div class="stats-card">
            <dt>Quads</dt>
            <dd data-face-count>0</dd>
          </div>
          <div class="stats-card">
            <dt>Triangles</dt>
            <dd data-triangle-count>0</dd>
          </div>
          <div class="stats-card">
            <dt>Draw Calls</dt>
            <dd data-draw-calls>0</dd>
          </div>
        </dl>
        <button class="lock-button" type="button" data-lock-button>
          Click To Fly
        </button>
      </div>
      <div class="viewport" data-viewport></div>
      <p class="footnote">WASD to strafe, Space and Shift to rise or descend. WebGPU now decodes packed chunk vertices and samples layered KTX2 materials with nearest magnification and mip-filtered distance.</p>
    </main>
  `

  const viewport = root.querySelector<HTMLElement>('[data-viewport]')
  const statusValue = root.querySelector<HTMLElement>('[data-status]')
  const pointerStateValue = root.querySelector<HTMLElement>(
    '[data-pointer-state]'
  )
  const fixedRateValue = root.querySelector<HTMLElement>('[data-fixed-rate]')
  const fpsValue = root.querySelector<HTMLElement>('[data-fps]')
  const vertexBytesValue = root.querySelector<HTMLElement>(
    '[data-vertex-bytes]'
  )
  const chunkCountValue = root.querySelector<HTMLElement>('[data-chunk-count]')
  const playerChunkValue = root.querySelector<HTMLElement>(
    '[data-player-chunk]'
  )
  const visibleChunksValue = root.querySelector<HTMLElement>(
    '[data-visible-chunks]'
  )
  const positionValue = root.querySelector<HTMLElement>('[data-position]')
  const faceCountValue = root.querySelector<HTMLElement>('[data-face-count]')
  const triangleCountValue = root.querySelector<HTMLElement>(
    '[data-triangle-count]'
  )
  const drawCallsValue = root.querySelector<HTMLElement>('[data-draw-calls]')
  const lockButton = root.querySelector<HTMLButtonElement>('[data-lock-button]')

  if (
    viewport === null ||
    statusValue === null ||
    pointerStateValue === null ||
    fixedRateValue === null ||
    fpsValue === null ||
    vertexBytesValue === null ||
    chunkCountValue === null ||
    playerChunkValue === null ||
    visibleChunksValue === null ||
    positionValue === null ||
    faceCountValue === null ||
    triangleCountValue === null ||
    drawCallsValue === null ||
    lockButton === null
  ) {
    throw new Error('Failed to mount debug world UI')
  }

  if (!WebGPU.isAvailable()) {
    statusValue.textContent = 'WebGPU unavailable'
    viewport.append(WebGPU.getErrorMessage())
    return () => {
      root.innerHTML = ''
    }
  }

  const renderer = new THREE.WebGPURenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  viewport.append(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x04060b)
  scene.fog = new THREE.Fog(0x04060b, 64, 180)

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 200)
  const movementSpeed = 8

  scene.add(new THREE.AmbientLight(0xf4efe4, 1.6))

  const keyLight = new THREE.DirectionalLight(0xf6d6a7, 2.6)
  keyLight.position.set(14, 18, 8)
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0x6eb7ff, 1.2)
  fillLight.position.set(-10, 8, -12)
  scene.add(fillLight)

  const terrainGenerator = new TerrainGenerator({ seed: 'kiseki' })
  const chunkStreamer = new ChunkStreamer({
    createChunk: (coords) => terrainGenerator.createChunk(coords),
    loadRadius: 1,
    unloadBuffer: 1,
  })
  let worldGroup = new THREE.Group()
  scene.add(worldGroup)
  let chunkMeshes: Array<DisposableMesh> = []
  let drawCalls = 0
  let totalFaceCount = 0
  let totalTriangleCount = 0
  let smoothedFps = 60
  let voxelChunkMaterial: THREE.MeshStandardNodeMaterial | null = null

  const rebuildWorldMeshes = (): void => {
    scene.remove(worldGroup)
    disposeMeshGeometries(worldGroup)

    const nextWorldGroup = new THREE.Group()
    const nextChunkMeshes: Array<DisposableMesh> = []
    let nextDrawCalls = 0
    let nextFaceCount = 0
    let nextTriangleCount = 0
    const activeMaterial = voxelChunkMaterial

    if (activeMaterial === null) {
      return
    }

    for (const entry of chunkStreamer.world.entries()) {
      const chunkMesh = createChunkMesh(
        entry.chunk,
        activeMaterial,
        chunkStreamer.world.getChunkNeighbors(entry.coords)
      )

      if (chunkMesh.solidCount === 0) {
        chunkMesh.mesh.geometry.dispose()
        continue
      }

      const origin = chunkOrigin(entry.coords)

      chunkMesh.mesh.position.set(origin.x, origin.y, origin.z)
      nextWorldGroup.add(chunkMesh.mesh)
      nextChunkMeshes.push(chunkMesh.mesh)
      nextDrawCalls += chunkMesh.drawCalls
      nextFaceCount += chunkMesh.faceCount
      nextTriangleCount += chunkMesh.triangleCount
    }

    worldGroup = nextWorldGroup
    chunkMeshes = nextChunkMeshes
    scene.add(worldGroup)
    worldGroup.updateMatrixWorld(true)
    drawCalls = nextDrawCalls
    totalFaceCount = nextFaceCount
    totalTriangleCount = nextTriangleCount
  }

  const syncStreamedWorld = (position: THREE.Vector3): void => {
    const streamUpdate = chunkStreamer.updateFromWorldPosition(position)

    if (streamUpdate.didChange) {
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

    return {
      drawCalls,
      faceCount: totalFaceCount,
      fps: smoothedFps,
      loadedChunkCount: chunkStreamer.world.size(),
      playerChunk,
      position: {
        x: currentCameraPosition.x,
        y: currentCameraPosition.y,
        z: currentCameraPosition.z,
      },
      triangleCount: totalTriangleCount,
      vertexBytesPerVertex: 4,
      visibleChunkCount: countVisibleChunkMeshes(camera, chunkMeshes),
    }
  }

  const applyStatsToHud = (): void => {
    const stats = buildStatsSnapshot()

    fpsValue.textContent = stats.fps.toFixed(1)
    vertexBytesValue.textContent = stats.vertexBytesPerVertex.toString()
    chunkCountValue.textContent = stats.loadedChunkCount.toString()
    playerChunkValue.textContent = chunkKey(stats.playerChunk)
    visibleChunksValue.textContent = stats.visibleChunkCount.toString()
    positionValue.textContent = `${stats.position.x.toFixed(
      1
    )}, ${stats.position.y.toFixed(1)}, ${stats.position.z.toFixed(1)}`
    faceCountValue.textContent = stats.faceCount.toString()
    triangleCountValue.textContent = stats.triangleCount.toString()
    drawCallsValue.textContent = stats.drawCalls.toString()
  }

  const updatePointerState = (): void => {
    pointerStateValue.textContent = controls.isLocked ? 'Locked' : 'Unlocked'
    lockButton.textContent = controls.isLocked
      ? 'Press Esc To Release'
      : 'Click To Fly'
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

  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('keyup', handleKeyUp)
  controls.addEventListener('lock', handleLock)
  controls.addEventListener('unlock', handleUnlock)
  lockButton.addEventListener('click', handleLockButtonClick)
  updatePointerState()

  fixedRateValue.textContent = '60'
  applyStatsToHud()
  const fixedLoop = new FixedStepLoop({ fixedDeltaSeconds: 1 / 60 })

  const uninstallDebugSurface = installKisekiDebugSurface({
    camera,
    chunkStreamer,
    getMeshInfo: () => {
      const firstMesh = chunkMeshes[0]

      if (firstMesh === undefined) {
        return null
      }

      return {
        attributeNames: Object.keys(firstMesh.geometry.attributes),
        indexCount: firstMesh.geometry.index?.count ?? 0,
        materialType: Array.isArray(firstMesh.material)
          ? 'ArrayMaterial'
          : firstMesh.material.type,
        vertexCount: firstMesh.geometry.attributes.packedData?.count ?? 0,
      }
    },
    getStats: buildStatsSnapshot,
    setCameraPosition: (x: number, y: number, z: number): void => {
      currentCameraPosition.set(x, y, z)
      previousCameraPosition.copy(currentCameraPosition)
      camera.position.copy(currentCameraPosition)
      camera.updateMatrixWorld()
      syncStreamedWorld(currentCameraPosition)
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
    statusValue.textContent = 'Loading texture arrays'
    const atlas = await loadVoxelTextureAtlas(renderer)
    voxelChunkMaterial = createVoxelChunkMaterial(atlas)
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
    uninstallDebugSurface()
    controls.dispose()
    voxelChunkMaterial?.dispose()
    void renderer.dispose()

    return () => {
      root.innerHTML = ''
    }
  }

  syncStreamedWorld(initialPosition)

  void renderer.setAnimationLoop((timestampMilliseconds?: number) => {
    const timestampSeconds = (timestampMilliseconds ?? 0) / 1000
    const frame = fixedLoop.advance(timestampSeconds)

    if (frame.frameTimeSeconds > 0) {
      const instantaneousFps = 1 / frame.frameTimeSeconds
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
  })

  return () => {
    void renderer.setAnimationLoop(null)
    window.removeEventListener('resize', resize)
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('keyup', handleKeyUp)
    controls.removeEventListener('lock', handleLock)
    controls.removeEventListener('unlock', handleUnlock)
    lockButton.removeEventListener('click', handleLockButtonClick)
    uninstallDebugSurface()
    controls.dispose()
    disposeMeshGeometries(worldGroup)
    voxelChunkMaterial?.dispose()
    void renderer.dispose()
    root.innerHTML = ''
  }
}
