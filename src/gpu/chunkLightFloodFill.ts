import { CHUNK_SIZE, CHUNK_VOLUME, xyz2i } from '../voxel/chunk.ts'
import {
  GPU_LIGHT_MAX_LEVEL,
  GPU_LIGHT_PROPAGATION_ITERATIONS,
} from './lightStorageCodec.ts'

const NEIGHBOR_OFFSETS = [
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

function hasOpenSkyColumn(voxels: Uint8Array, x: number, y: number, z: number) {
  for (let sampleY = y; sampleY < CHUNK_SIZE; sampleY += 1) {
    if (getMaterial(voxels, x, sampleY, z) !== 0) {
      return false
    }
  }

  return true
}

export function generateFloodFillLightLevels(
  voxels: Uint8Array,
  iterations = GPU_LIGHT_PROPAGATION_ITERATIONS
): Uint8Array {
  let read = new Uint8Array(CHUNK_VOLUME)
  let write = new Uint8Array(CHUNK_VOLUME)

  for (let z = 0; z < CHUNK_SIZE; z += 1) {
    for (let y = 0; y < CHUNK_SIZE; y += 1) {
      for (let x = 0; x < CHUNK_SIZE; x += 1) {
        const index = xyz2i(x, y, z)

        if (hasOpenSkyColumn(voxels, x, y, z)) {
          read[index] = GPU_LIGHT_MAX_LEVEL
        }
      }
    }
  }

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    write.fill(0)

    for (let z = 0; z < CHUNK_SIZE; z += 1) {
      for (let y = 0; y < CHUNK_SIZE; y += 1) {
        for (let x = 0; x < CHUNK_SIZE; x += 1) {
          const index = xyz2i(x, y, z)

          if (getMaterial(voxels, x, y, z) !== 0) {
            continue
          }

          let lightLevel = read[index] ?? 0

          for (const offset of NEIGHBOR_OFFSETS) {
            const neighborX = x + offset.x
            const neighborY = y + offset.y
            const neighborZ = z + offset.z

            if (
              neighborX < 0 ||
              neighborX >= CHUNK_SIZE ||
              neighborY < 0 ||
              neighborY >= CHUNK_SIZE ||
              neighborZ < 0 ||
              neighborZ >= CHUNK_SIZE
            ) {
              continue
            }

            const neighborLight =
              read[xyz2i(neighborX, neighborY, neighborZ)] ?? 0

            if (neighborLight > 0) {
              lightLevel = Math.max(lightLevel, neighborLight - 1)
            }
          }

          write[index] = lightLevel
        }
      }
    }

    const previous = read
    read = write
    write = previous
  }

  return read
}
