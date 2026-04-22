import * as THREE from 'three/webgpu'
import WebGPU from 'three/addons/capabilities/WebGPU.js'

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
        <p class="eyebrow">Kiseki / Step 6</p>
        <h1 class="title">Fixed Update Loop</h1>
        <p class="subtitle">
          Simulation advances at a fixed 60 Hz, while rendering interpolates between the last two update states.
        </p>
        <dl class="stats">
          <div class="stats-card">
            <dt>Status</dt>
            <dd data-status>Checking WebGPU</dd>
          </div>
          <div class="stats-card">
            <dt>Fixed Hz</dt>
            <dd data-fixed-rate>60</dd>
          </div>
          <div class="stats-card">
            <dt>Last Steps</dt>
            <dd data-step-count>0</dd>
          </div>
          <div class="stats-card">
            <dt>Interp Alpha</dt>
            <dd data-alpha>0.00</dd>
          </div>
          <div class="stats-card">
            <dt>Draw Calls</dt>
            <dd data-draw-calls>0</dd>
          </div>
        </dl>
      </div>
      <div class="viewport" data-viewport></div>
      <p class="footnote">Auto-orbit is now simulation driven. Fly camera lands in step 7.</p>
    </main>
  `

  const viewport = root.querySelector<HTMLElement>('[data-viewport]')
  const statusValue = root.querySelector<HTMLElement>('[data-status]')
  const fixedRateValue = root.querySelector<HTMLElement>('[data-fixed-rate]')
  const stepCountValue = root.querySelector<HTMLElement>('[data-step-count]')
  const alphaValue = root.querySelector<HTMLElement>('[data-alpha]')
  const drawCallsValue = root.querySelector<HTMLElement>('[data-draw-calls]')

  if (
    viewport === null ||
    statusValue === null ||
    fixedRateValue === null ||
    stepCountValue === null ||
    alphaValue === null ||
    drawCallsValue === null
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

  mesh.position.set(-center.x, -bounds.min.y, -center.z)
  scene.add(mesh)

  fixedRateValue.textContent = '60'
  drawCallsValue.textContent = drawCalls.toString()

  const orbitTarget = new THREE.Vector3(0, Math.max(size.y * 0.35, 1.5), 0)
  const orbitRadius = Math.max(size.length() * 0.72, 16)
  const cameraHeight = Math.max(size.y * 1.15, 10)
  const orbitSpeed = 0.28
  const fixedLoop = new FixedStepLoop({ fixedDeltaSeconds: 1 / 60 })

  let previousOrbitAngle = 0
  let currentOrbitAngle = 0

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
    void renderer.dispose()

    return () => {
      root.innerHTML = ''
    }
  }

  void renderer.setAnimationLoop((timestampMilliseconds?: number) => {
    const timestampSeconds = (timestampMilliseconds ?? 0) / 1000
    const frame = fixedLoop.advance(timestampSeconds)

    for (let step = 0; step < frame.steps; step += 1) {
      previousOrbitAngle = currentOrbitAngle
      currentOrbitAngle += orbitSpeed * frame.fixedDeltaSeconds
    }

    if (frame.steps === 0) {
      previousOrbitAngle = currentOrbitAngle
    }

    const interpolatedAngle = THREE.MathUtils.lerp(
      previousOrbitAngle,
      currentOrbitAngle,
      frame.alpha
    )

    camera.position.set(
      Math.cos(interpolatedAngle) * orbitRadius,
      cameraHeight + Math.sin(interpolatedAngle * 1.8) * 1.25,
      Math.sin(interpolatedAngle) * orbitRadius
    )
    camera.lookAt(orbitTarget)

    stepCountValue.textContent = frame.steps.toString()
    alphaValue.textContent = frame.alpha.toFixed(2)

    void renderer.render(scene, camera)
  })

  return () => {
    void renderer.setAnimationLoop(null)
    window.removeEventListener('resize', resize)
    disposeObject(scene)
    void renderer.dispose()
    root.innerHTML = ''
  }
}
