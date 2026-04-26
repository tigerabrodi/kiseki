import * as THREE from 'three/webgpu'

const CHUNK_REVEAL_USER_DATA_KEY = 'chunkRevealFactor'

export const CHUNK_REVEAL_DURATION_SECONDS = 0.85

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1)
}

export function getObjectChunkRevealFactor(
  object: THREE.Object3D | null
): number {
  const value = object?.userData[CHUNK_REVEAL_USER_DATA_KEY] as unknown

  return typeof value === 'number' ? clamp01(value) : 1
}

export function setObjectChunkRevealFactor(
  object: THREE.Object3D,
  value: number
): number {
  const clampedValue = clamp01(value)

  object.userData[CHUNK_REVEAL_USER_DATA_KEY] = clampedValue

  return clampedValue
}

export function resetObjectChunkReveal(object: THREE.Object3D): void {
  setObjectChunkRevealFactor(object, 0)
}

export function advanceChunkRevealFactors(
  objects: ReadonlyArray<THREE.Object3D>,
  deltaSeconds: number,
  durationSeconds = CHUNK_REVEAL_DURATION_SECONDS
): number {
  if (deltaSeconds <= 0 || durationSeconds <= 0) {
    return 0
  }

  const step = deltaSeconds / durationSeconds
  let activeCount = 0

  for (const object of objects) {
    const nextRevealFactor = setObjectChunkRevealFactor(
      object,
      getObjectChunkRevealFactor(object) + step
    )

    if (nextRevealFactor < 1) {
      activeCount += 1
    }
  }

  return activeCount
}
