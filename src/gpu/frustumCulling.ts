import * as THREE from 'three/webgpu'

type ChunkOriginLike = Pick<THREE.Vector3, 'x' | 'y' | 'z'>

const FRUSTUM_PLANE_COUNT = 6
const FRUSTUM_PLANE_WORD_COUNT = 4

function writePlane(
  planes: Float32Array,
  planeIndex: number,
  plane: THREE.Plane
): void {
  const baseIndex = planeIndex * FRUSTUM_PLANE_WORD_COUNT
  const planeLength = plane.normal.length()

  if (planeLength === 0) {
    planes[baseIndex] = 0
    planes[baseIndex + 1] = 0
    planes[baseIndex + 2] = 0
    planes[baseIndex + 3] = 0
    return
  }

  planes[baseIndex] = plane.normal.x / planeLength
  planes[baseIndex + 1] = plane.normal.y / planeLength
  planes[baseIndex + 2] = plane.normal.z / planeLength
  planes[baseIndex + 3] = plane.constant / planeLength
}

export function countVisibleChunkSlots(
  visibilityWords: Uint32Array,
  slotCount: number
): number {
  let visibleChunkCount = 0

  for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
    const wordIndex = slotIndex >>> 5
    const bitIndex = slotIndex & 31
    const word = visibilityWords[wordIndex] ?? 0

    if (((word >>> bitIndex) & 1) === 1) {
      visibleChunkCount += 1
    }
  }

  return visibleChunkCount
}

export function extractCameraFrustumPlanes(camera: THREE.Camera): Float32Array {
  const frustum = new THREE.Frustum()
  const projectionMatrix = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  )
  const planes = new Float32Array(
    FRUSTUM_PLANE_COUNT * FRUSTUM_PLANE_WORD_COUNT
  )

  frustum.setFromProjectionMatrix(projectionMatrix)

  for (const [planeIndex, plane] of frustum.planes.entries()) {
    writePlane(planes, planeIndex, plane)
  }

  return planes
}

export function isChunkBoundsVisible(
  frustumPlanes: ArrayLike<number>,
  origin: ChunkOriginLike,
  chunkSize: number
): boolean {
  const halfExtent = chunkSize / 2
  const centerX = origin.x + halfExtent
  const centerY = origin.y + halfExtent
  const centerZ = origin.z + halfExtent

  for (let planeIndex = 0; planeIndex < FRUSTUM_PLANE_COUNT; planeIndex += 1) {
    const baseIndex = planeIndex * FRUSTUM_PLANE_WORD_COUNT
    const normalX = frustumPlanes[baseIndex] ?? 0
    const normalY = frustumPlanes[baseIndex + 1] ?? 0
    const normalZ = frustumPlanes[baseIndex + 2] ?? 0
    const constant = frustumPlanes[baseIndex + 3] ?? 0
    const signedDistance =
      normalX * centerX + normalY * centerY + normalZ * centerZ + constant
    const radius =
      Math.abs(normalX) * halfExtent +
      Math.abs(normalY) * halfExtent +
      Math.abs(normalZ) * halfExtent

    if (signedDistance + radius < 0) {
      return false
    }
  }

  return true
}
