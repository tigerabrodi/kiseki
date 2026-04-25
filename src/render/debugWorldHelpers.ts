import * as THREE from 'three/webgpu'

import type { FlyInputState } from '../camera/getFlyMovementIntent.ts'

export type DebugWorldHandle = () => void

export type DisposableMesh = THREE.Mesh<
  THREE.BufferGeometry,
  THREE.Material | Array<THREE.Material>
>

type PerformanceWithMemory = Performance & {
  memory?: {
    usedJSHeapSize: number
  }
}

export function createInputState(): FlyInputState {
  return {
    backward: false,
    down: false,
    forward: false,
    left: false,
    right: false,
    up: false,
  }
}

export function isDisposableMesh(
  object: THREE.Object3D
): object is DisposableMesh {
  return object instanceof THREE.Mesh
}

export function getSceneBackgroundType(
  background: THREE.Color | THREE.Texture | null
): string {
  if (background === null) {
    return 'none'
  }

  if (background instanceof THREE.Color) {
    return 'Color'
  }

  return background.constructor.name
}

export function disposeMeshGeometries(root: THREE.Object3D): void {
  root.traverse((child: THREE.Object3D) => {
    if (!isDisposableMesh(child)) {
      return
    }

    child.geometry.dispose()
  })
}

export function disposeChunkMeshPool(
  chunkMeshSlotMap: Map<number, DisposableMesh>
): void {
  for (const mesh of new Set(chunkMeshSlotMap.values())) {
    mesh.geometry.dispose()
  }

  chunkMeshSlotMap.clear()
}

export function turnCameraByDegrees(
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

export function getJsHeapBytes(): number | null {
  const performanceWithMemory = performance as PerformanceWithMemory

  return performanceWithMemory.memory?.usedJSHeapSize ?? null
}

export function bytesToMegabytes(bytes: number): number {
  return bytes / (1024 * 1024)
}

export function getPipelineState(
  hasGpuFullPipeline: boolean,
  hasGpuVisibilityCulling: boolean,
  hasGpuIndirectDrawCulling: boolean,
  hasGpuOcclusionCulling = false
): string {
  if (!hasGpuFullPipeline) {
    return 'Mixed'
  }

  if (hasGpuOcclusionCulling) {
    return 'GPU Full + Occlusion'
  }

  if (hasGpuIndirectDrawCulling) {
    return 'GPU Full + Indirect'
  }

  return hasGpuVisibilityCulling ? 'GPU Full + Cull' : 'GPU Full'
}

export function updatePointerHud(
  isLocked: boolean,
  lockButton: HTMLButtonElement,
  pointerStateValue: HTMLElement
): void {
  pointerStateValue.textContent = isLocked ? 'Locked' : 'Unlocked'
  lockButton.textContent = isLocked ? 'Press Esc To Release' : 'Click To Fly'
}
