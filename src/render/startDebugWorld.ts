import * as THREE from 'three/webgpu'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import WebGPU from 'three/addons/capabilities/WebGPU.js'

import {
  getFlyMovementIntent,
  type FlyInputState,
} from '../camera/getFlyMovementIntent.ts'
import { FixedStepLoop } from '../core/FixedStepLoop.ts'
import { createChunkMesh } from '../mesh/createChunkMesh.ts'
import { createDebugChunk } from '../world/createDebugChunk.ts'

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
        <p class="eyebrow">Kiseki / Step 7</p>
        <h1 class="title">Fly Camera</h1>
        <p class="subtitle">
          Pointer lock handles mouse look, while movement runs through the fixed 60 Hz simulation loop.
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
            <dt>Position</dt>
            <dd data-position>0, 0, 0</dd>
          </div>
          <div class="stats-card">
            <dt>Speed</dt>
            <dd data-speed>8 u/s</dd>
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
      <p class="footnote">WASD to strafe, Space and Shift for vertical movement, Esc to release the mouse.</p>
    </main>
  `

  const viewport = root.querySelector<HTMLElement>('[data-viewport]')
  const statusValue = root.querySelector<HTMLElement>('[data-status]')
  const pointerStateValue = root.querySelector<HTMLElement>(
    '[data-pointer-state]'
  )
  const fixedRateValue = root.querySelector<HTMLElement>('[data-fixed-rate]')
  const positionValue = root.querySelector<HTMLElement>('[data-position]')
  const speedValue = root.querySelector<HTMLElement>('[data-speed]')
  const drawCallsValue = root.querySelector<HTMLElement>('[data-draw-calls]')
  const lockButton = root.querySelector<HTMLButtonElement>('[data-lock-button]')

  if (
    viewport === null ||
    statusValue === null ||
    pointerStateValue === null ||
    fixedRateValue === null ||
    positionValue === null ||
    speedValue === null ||
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
  scene.fog = new THREE.Fog(0x04060b, 18, 42)

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 200)
  const movementSpeed = 8

  scene.add(new THREE.AmbientLight(0xf4efe4, 1.6))

  const keyLight = new THREE.DirectionalLight(0xf6d6a7, 2.6)
  keyLight.position.set(14, 18, 8)
  scene.add(keyLight)

  const fillLight = new THREE.DirectionalLight(0x6eb7ff, 1.2)
  fillLight.position.set(-10, 8, -12)
  scene.add(fillLight)

  const { drawCalls, mesh } = createChunkMesh(createDebugChunk())

  mesh.updateMatrixWorld(true)

  const bounds = new THREE.Box3().setFromObject(mesh)
  const center = bounds.getCenter(new THREE.Vector3())
  const size = bounds.getSize(new THREE.Vector3())
  const flyTarget = new THREE.Vector3(0, Math.max(size.y * 0.35, 1.5), 0)
  const orbitRadius = Math.max(size.length() * 0.72, 16)
  const cameraHeight = Math.max(size.y * 1.15, 10)

  mesh.position.set(-center.x, -bounds.min.y, -center.z)
  scene.add(mesh)

  const initialPosition = new THREE.Vector3(
    orbitRadius * 0.74,
    cameraHeight,
    orbitRadius * 0.74
  )
  camera.position.copy(initialPosition)
  camera.lookAt(flyTarget)

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
  speedValue.textContent = `${movementSpeed} u/s`
  positionValue.textContent = `${initialPosition.x.toFixed(1)}, ${initialPosition.y.toFixed(
    1
  )}, ${initialPosition.z.toFixed(1)}`
  drawCallsValue.textContent = drawCalls.toString()
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

    positionValue.textContent = `${currentCameraPosition.x.toFixed(
      1
    )}, ${currentCameraPosition.y.toFixed(1)}, ${currentCameraPosition.z.toFixed(
      1
    )}`
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
