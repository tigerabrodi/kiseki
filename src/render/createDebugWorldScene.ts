import * as THREE from 'three/webgpu'

export type DebugWorldScene = {
  camera: THREE.PerspectiveCamera
  canvas: HTMLCanvasElement
  lightingRig: DebugWorldLightingRig
  renderer: THREE.WebGPURenderer
  scene: THREE.Scene
}

export type DebugWorldLightingRig = {
  ambientLight: THREE.AmbientLight
  fillLight: THREE.DirectionalLight
  sunLight: THREE.DirectionalLight
}

type CreateDebugWorldSceneOptions = {
  trackGpuTimestamps?: boolean
}

export function createDebugWorldScene(
  viewport: HTMLElement,
  options: CreateDebugWorldSceneOptions = {}
): DebugWorldScene {
  const renderer = new THREE.WebGPURenderer({
    antialias: true,
    trackTimestamp: options.trackGpuTimestamps ?? false,
  })
  const canvas = renderer.domElement
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 320)

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  viewport.append(canvas)

  scene.background = new THREE.Color(0x04060b)
  scene.backgroundBlurriness = 0.18
  scene.backgroundIntensity = 0.45
  scene.environmentIntensity = 0.9

  const ambientLight = new THREE.AmbientLight(0xf4efe4, 0.45)
  scene.add(ambientLight)

  const sunLight = new THREE.DirectionalLight(0xf6d6a7, 1.7)
  sunLight.position.set(14, 18, 8)
  scene.add(sunLight)

  const fillLight = new THREE.DirectionalLight(0x6eb7ff, 0.55)
  fillLight.position.set(-10, 8, -12)
  scene.add(fillLight)

  return {
    camera,
    canvas,
    lightingRig: {
      ambientLight,
      fillLight,
      sunLight,
    },
    renderer,
    scene,
  }
}
