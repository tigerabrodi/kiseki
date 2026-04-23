import { CHUNK_VOLUME, type Chunk } from '../voxel/chunk.ts'

export const GPU_VOXEL_BYTES_PER_VOXEL = 4
export const GPU_VOXEL_BUFFER_BYTE_LENGTH =
  CHUNK_VOLUME * GPU_VOXEL_BYTES_PER_VOXEL

export function encodeChunkVoxelsForGpu(chunk: Chunk): Uint32Array {
  return Uint32Array.from(chunk.voxels, (materialId) => materialId)
}

export function decodeGpuVoxelData(gpuData: Uint32Array): Uint8Array {
  if (gpuData.length !== CHUNK_VOLUME) {
    throw new RangeError(
      `Expected ${CHUNK_VOLUME} voxels in GPU readback, got ${gpuData.length}`
    )
  }

  const voxels = new Uint8Array(CHUNK_VOLUME)

  for (let index = 0; index < gpuData.length; index += 1) {
    const materialId = gpuData[index] ?? 0

    if (!Number.isInteger(materialId) || materialId < 0 || materialId > 0xff) {
      throw new RangeError(
        `GPU voxel readback values must stay between 0 and 255, got ${materialId} at index ${index}`
      )
    }

    voxels[index] = materialId
  }

  return voxels
}
