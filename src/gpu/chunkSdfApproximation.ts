import { CHUNK_SIZE, xyz2i } from '../voxel/chunk.ts'
import { GPU_SDF_MAX_DISTANCE } from './sdfStorageCodec.ts'

const DIRECTIONS = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
] as const

function getMaterial(
  voxels: Uint8Array,
  x: number,
  y: number,
  z: number
): number {
  if (
    x < 0 ||
    x >= CHUNK_SIZE ||
    y < 0 ||
    y >= CHUNK_SIZE ||
    z < 0 ||
    z >= CHUNK_SIZE
  ) {
    return 0
  }

  return voxels[xyz2i(x, y, z)] ?? 0
}

export function calculateAxisSignedDistance(
  voxels: Uint8Array,
  x: number,
  y: number,
  z: number,
  maxDistance = GPU_SDF_MAX_DISTANCE
): number {
  const isSolid = getMaterial(voxels, x, y, z) !== 0
  let nearestDistance = maxDistance + 1

  for (const direction of DIRECTIONS) {
    for (let step = 1; step <= maxDistance; step += 1) {
      const isNeighborSolid =
        getMaterial(
          voxels,
          x + direction.x * step,
          y + direction.y * step,
          z + direction.z * step
        ) !== 0

      if (isNeighborSolid !== isSolid) {
        nearestDistance = Math.min(nearestDistance, step)
        break
      }
    }
  }

  const unsignedDistance = Math.min(nearestDistance, maxDistance) - 0.5

  return isSolid ? -unsignedDistance : unsignedDistance
}
