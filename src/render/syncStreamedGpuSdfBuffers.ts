import type { GpuChunkSdfCache } from '../gpu/GpuChunkSdfCache.ts'
import type { GpuChunkVoxelCache } from '../gpu/GpuChunkVoxelCache.ts'
import type { GpuSdfGenerator } from '../gpu/GpuSdfGenerator.ts'
import type { ChunkStreamUpdate } from '../world/ChunkStreamer.ts'
import type { ChunkCoordinates } from '../world/World.ts'

type SyncStreamedGpuSdfBuffersOptions = {
  gpuSdfCache: GpuChunkSdfCache | null
  gpuSdfGenerator: GpuSdfGenerator | null
  gpuVoxelCache: GpuChunkVoxelCache | null
  update: Pick<ChunkStreamUpdate, 'loaded' | 'unloaded'>
}

export type SyncStreamedGpuSdfBuffersResult = {
  generatedChunkCount: number
  sdfGenerationTimeMs: number
}

export function regenerateGpuSdfChunks(options: {
  chunkCoords: Array<ChunkCoordinates>
  gpuSdfCache: GpuChunkSdfCache | null
  gpuSdfGenerator: GpuSdfGenerator | null
  gpuVoxelCache: GpuChunkVoxelCache | null
}): number {
  const { gpuSdfCache, gpuSdfGenerator, gpuVoxelCache } = options
  let generatedChunkCount = 0

  if (
    gpuSdfCache === null ||
    gpuSdfGenerator === null ||
    gpuVoxelCache === null
  ) {
    return generatedChunkCount
  }

  for (const coords of options.chunkCoords) {
    const voxelHandle = gpuVoxelCache.getBuffer(coords)
    const sdfHandle = gpuSdfCache.getBuffer(coords)

    if (voxelHandle === undefined || sdfHandle === undefined) {
      continue
    }

    gpuSdfGenerator.generateChunk(voxelHandle, sdfHandle)
    generatedChunkCount += 1
  }

  return generatedChunkCount
}

export function syncStreamedGpuSdfBuffers(
  options: SyncStreamedGpuSdfBuffersOptions
): SyncStreamedGpuSdfBuffersResult {
  const sdfGenerationStartMs = performance.now()

  options.gpuSdfCache?.sync(options.update)

  const generatedChunkCount = regenerateGpuSdfChunks({
    chunkCoords: options.update.loaded.map((entry) => entry.coords),
    gpuSdfCache: options.gpuSdfCache,
    gpuSdfGenerator: options.gpuSdfGenerator,
    gpuVoxelCache: options.gpuVoxelCache,
  })

  return {
    generatedChunkCount,
    sdfGenerationTimeMs: performance.now() - sdfGenerationStartMs,
  }
}
