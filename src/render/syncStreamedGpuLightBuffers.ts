import type { GpuChunkLightCache } from '../gpu/GpuChunkLightCache.ts'
import type { GpuChunkVoxelCache } from '../gpu/GpuChunkVoxelCache.ts'
import type { GpuLightGenerator } from '../gpu/GpuLightGenerator.ts'
import type { ChunkStreamUpdate } from '../world/ChunkStreamer.ts'
import type { ChunkCoordinates } from '../world/World.ts'

type SyncStreamedGpuLightBuffersOptions = {
  gpuLightCache: GpuChunkLightCache | null
  gpuLightGenerator: GpuLightGenerator | null
  gpuVoxelCache: GpuChunkVoxelCache | null
  update: Pick<ChunkStreamUpdate, 'loaded' | 'unloaded'>
}

export type SyncStreamedGpuLightBuffersResult = {
  generatedChunkCount: number
  lightGenerationTimeMs: number
}

export function regenerateGpuLightChunks(options: {
  chunkCoords: Array<ChunkCoordinates>
  gpuLightCache: GpuChunkLightCache | null
  gpuLightGenerator: GpuLightGenerator | null
  gpuVoxelCache: GpuChunkVoxelCache | null
}): number {
  const { gpuLightCache, gpuLightGenerator, gpuVoxelCache } = options
  let generatedChunkCount = 0

  if (
    gpuLightCache === null ||
    gpuLightGenerator === null ||
    gpuVoxelCache === null
  ) {
    return generatedChunkCount
  }

  for (const coords of options.chunkCoords) {
    const voxelHandle = gpuVoxelCache.getBuffer(coords)
    const lightHandle = gpuLightCache.getBuffer(coords)

    if (voxelHandle === undefined || lightHandle === undefined) {
      continue
    }

    gpuLightGenerator.generateChunk(voxelHandle, lightHandle)
    generatedChunkCount += 1
  }

  return generatedChunkCount
}

export function syncStreamedGpuLightBuffers(
  options: SyncStreamedGpuLightBuffersOptions
): SyncStreamedGpuLightBuffersResult {
  const lightGenerationStartMs = performance.now()

  options.gpuLightCache?.sync(options.update)

  const generatedChunkCount = regenerateGpuLightChunks({
    chunkCoords: options.update.loaded.map((entry) => entry.coords),
    gpuLightCache: options.gpuLightCache,
    gpuLightGenerator: options.gpuLightGenerator,
    gpuVoxelCache: options.gpuVoxelCache,
  })

  return {
    generatedChunkCount,
    lightGenerationTimeMs: performance.now() - lightGenerationStartMs,
  }
}
