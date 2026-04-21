import * as THREE from 'three/webgpu'
import WebGPU from 'three/addons/capabilities/WebGPU.js'

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
        <p class="eyebrow">Kiseki / Step 4</p>
        <h1 class="title">Custom Chunk Geometry</h1>
        <p class="subtitle">
          One BufferGeometry per chunk, with positions, normals, and indices written by hand.
        </p>
        <dl class="stats">
          <div class="stats-card">
            <dt>Status</dt>
            <dd data-status>Checking WebGPU</dd>
          </div>
          <div class="stats-card">
            <dt>Solid Voxels</dt>
            <dd data-solid-count>0</dd>
          </div>
          <div class="stats-card">
            <dt>Draw Calls</dt>
            <dd data-draw-calls>0</dd>
          </div>
        </dl>
      </div>
      <div class="viewport" data-viewport></div>
      <p class="footnote">Still emitting all six faces. Face culling lands in step 5.</p>
    </main>
  `

  const viewport = root.querySelector<HTMLElement>('[data-viewport]')
  const statusValue = root.querySelector<HTMLElement>('[data-status]')
  const solidCountValue = root.querySelector<HTMLElement>('[data-solid-count]')
  const drawCallsValue = root.querySelector<HTMLElement>('[data-draw-calls]')

  if (
    viewport === null ||
    statusValue === null ||
    solidCountValue === null ||
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

  const { drawCalls, mesh, solidCount } = createChunkMesh(createDebugChunk())

  mesh.updateMatrixWorld(true)

  const bounds = new THREE.Box3().setFromObject(mesh)
  const center = bounds.getCenter(new THREE.Vector3())
  const size = bounds.getSize(new THREE.Vector3())

  mesh.position.set(-center.x, -bounds.min.y, -center.z)
  scene.add(mesh)

  solidCountValue.textContent = solidCount.toString()
  drawCallsValue.textContent = drawCalls.toString()

  const target = new THREE.Vector3(0, Math.max(size.y * 0.35, 1.5), 0)
  const orbitRadius = Math.max(size.length() * 0.72, 16)
  const cameraHeight = Math.max(size.y * 1.15, 10)
  const clock = new THREE.Clock()

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

  void renderer.setAnimationLoop(() => {
    const elapsed = clock.getElapsedTime() * 0.28

    camera.position.set(
      Math.cos(elapsed) * orbitRadius,
      cameraHeight + Math.sin(elapsed * 1.8) * 1.25,
      Math.sin(elapsed) * orbitRadius
    )
    camera.lookAt(target)

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
