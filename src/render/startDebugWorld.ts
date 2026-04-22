import * as THREE from 'three/webgpu'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import WebGPU from 'three/addons/capabilities/WebGPU.js'

import {
  getFlyMovementIntent,
  type FlyInputState,
} from '../camera/getFlyMovementIntent.ts'
import { FixedStepLoop } from '../core/FixedStepLoop.ts'
import { createChunkMesh } from '../mesh/createChunkMesh.ts'
import { countVisibleChunkMeshes } from './countVisibleChunkMeshes.ts'
import { ChunkStreamer } from '../world/ChunkStreamer.ts'
import { chunkKey, chunkOrigin } from '../world/World.ts'
import { TerrainGenerator } from '../world/TerrainGenerator.ts'

type DebugWorldHandle = () => void
type DisposableMesh = THREE.Mesh<
  THREE.BufferGeometry,
  THREE.Material | Array<THREE.Material>
>

function disposeMaterial(material: THREE.Material): void {
  material.dispose()
}

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

function disposeObject(root: THREE.Object3D): void {
  root.traverse((child: THREE.Object3D) => {
    if (!isDisposableMesh(child)) {
      return
    }

    child.geometry.dispose()

    if (Array.isArray(child.material)) {
      child.material.forEach(disposeMaterial)
    } else {
      disposeMaterial(child.material)
    }
  })
}

export async function startDebugWorld(
  root: HTMLElement
): Promise<DebugWorldHandle> {
  root.innerHTML = `
    <main class="app-shell">
      <div class="hud">
        <p class="eyebrow">Kiseki / Step 12</p>
        <h1 class="title">Frustum Culling</h1>
        <p class="subtitle">
          Chunk bounds now feed frustum culling, so off-screen terrain can stay loaded for streaming without being rendered every frame.
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
            <dt>Faces</dt>
            <dd data-face-count>0</dd>
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
      <p class="footnote">WASD to strafe, Space and Shift to rise or descend. Turn away from the terrain and the visible-chunk count should drop below the loaded chunk count.</p>
    </main>
  `

  const viewport = root.querySelector<HTMLElement>('[data-viewport]')
  const statusValue = root.querySelector<HTMLElement>('[data-status]')
  const pointerStateValue = root.querySelector<HTMLElement>(
    '[data-pointer-state]'
  )
  const fixedRateValue = root.querySelector<HTMLElement>('[data-fixed-rate]')
  const chunkCountValue = root.querySelector<HTMLElement>('[data-chunk-count]')
  const playerChunkValue = root.querySelector<HTMLElement>(
    '[data-player-chunk]'
  )
  const visibleChunksValue = root.querySelector<HTMLElement>(
    '[data-visible-chunks]'
  )
  const positionValue = root.querySelector<HTMLElement>('[data-position]')
  const faceCountValue = root.querySelector<HTMLElement>('[data-face-count]')
  const drawCallsValue = root.querySelector<HTMLElement>('[data-draw-calls]')
  const lockButton = root.querySelector<HTMLButtonElement>('[data-lock-button]')

  if (
    viewport === null ||
    statusValue === null ||
    pointerStateValue === null ||
    fixedRateValue === null ||
    chunkCountValue === null ||
    playerChunkValue === null ||
    visibleChunksValue === null ||
    positionValue === null ||
    faceCountValue === null ||
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

  const rebuildWorldMeshes = (): void => {
    scene.remove(worldGroup)
    disposeObject(worldGroup)

    const nextWorldGroup = new THREE.Group()
    const nextChunkMeshes: Array<DisposableMesh> = []
    let nextDrawCalls = 0
    let nextFaceCount = 0

    for (const entry of chunkStreamer.world.entries()) {
      const chunkMesh = createChunkMesh(
        entry.chunk,
        chunkStreamer.world.getChunkNeighbors(entry.coords)
      )

      if (chunkMesh.solidCount === 0) {
        disposeObject(chunkMesh.mesh)
        continue
      }

      const origin = chunkOrigin(entry.coords)

      chunkMesh.mesh.position.set(origin.x, origin.y, origin.z)
      nextWorldGroup.add(chunkMesh.mesh)
      nextChunkMeshes.push(chunkMesh.mesh)
      nextDrawCalls += chunkMesh.drawCalls
      nextFaceCount += chunkMesh.faceCount
    }

    worldGroup = nextWorldGroup
    chunkMeshes = nextChunkMeshes
    scene.add(worldGroup)
    worldGroup.updateMatrixWorld(true)
    drawCalls = nextDrawCalls
    totalFaceCount = nextFaceCount
    chunkCountValue.textContent = chunkStreamer.world.size().toString()
    faceCountValue.textContent = totalFaceCount.toString()
    drawCallsValue.textContent = drawCalls.toString()
    visibleChunksValue.textContent = countVisibleChunkMeshes(
      camera,
      chunkMeshes
    ).toString()
  }

  const syncStreamedWorld = (position: THREE.Vector3): void => {
    const streamUpdate = chunkStreamer.updateFromWorldPosition(position)
    playerChunkValue.textContent = chunkKey(streamUpdate.playerChunk)

    if (streamUpdate.didChange) {
      rebuildWorldMeshes()
    }
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
  syncStreamedWorld(initialPosition)

  const controls = new PointerLockControls(camera, renderer.domElement)
  controls.pointerSpeed = 0.75

  const inputState = createInputState()
  const previousCameraPosition = initialPosition.clone()
  const currentCameraPosition = initialPosition.clone()

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
  positionValue.textContent = `${initialPosition.x.toFixed(1)}, ${initialPosition.y.toFixed(
    1
  )}, ${initialPosition.z.toFixed(1)}`
  const fixedLoop = new FixedStepLoop({ fixedDeltaSeconds: 1 / 60 })

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
    statusValue.textContent = 'WebGPU ready'
  } catch (error) {
    statusValue.textContent = 'Renderer init failed'
    const message = document.createElement('pre')
    message.textContent =
      error instanceof Error
        ? error.message
        : 'Unknown WebGPU initialization error'
    viewport.append(message)

    window.removeEventListener('resize', resize)
    document.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('keyup', handleKeyUp)
    controls.removeEventListener('lock', handleLock)
    controls.removeEventListener('unlock', handleUnlock)
    lockButton.removeEventListener('click', handleLockButtonClick)
    controls.dispose()
    void renderer.dispose()

    return () => {
      root.innerHTML = ''
    }
  }

  void renderer.setAnimationLoop((timestampMilliseconds?: number) => {
    const timestampSeconds = (timestampMilliseconds ?? 0) / 1000
    const frame = fixedLoop.advance(timestampSeconds)

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
    positionValue.textContent = `${currentCameraPosition.x.toFixed(
      1
    )}, ${currentCameraPosition.y.toFixed(1)}, ${currentCameraPosition.z.toFixed(
      1
    )}`
    visibleChunksValue.textContent = countVisibleChunkMeshes(
      camera,
      chunkMeshes
    ).toString()
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
    controls.dispose()
    disposeObject(scene)
    void renderer.dispose()
    root.innerHTML = ''
  }
}
