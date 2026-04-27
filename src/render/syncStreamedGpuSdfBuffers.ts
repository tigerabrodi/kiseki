import type { GpuChunkSdfCache } from '../gpu/GpuChunkSdfCache.ts'
import type { GpuChunkVoxelCache } from '../gpu/GpuChunkVoxelCache.ts'
import type { GpuSdfGenerator } from '../gpu/GpuSdfGenerator.ts'
import type { ChunkStreamUpdate } from '../world/ChunkStreamer.ts'
import type { ChunkCoordinates } from '../world/World.ts'
import {
  regenerateGpuGeneratedChunkBuffers,
  syncStreamedGpuGeneratedChunkBuffers,
} from './syncStreamedGpuGeneratedChunkBuffers.ts'

type SyncStreamedGpuSdfBuffersOptions = {
  gpuSdfCache: GpuChunkSdfCache | null
  gpuSdfGenerator: GpuSdfGenerator | null
  gpuVoxelCache: GpuChunkVoxelCache | null
  update: Pick<ChunkStreamUpdate, 'loaded' | 'unloaded'>
}

export type SyncStreamedGpuSdfBuffersResult = {
  generatedChunkCount: number
  gpuComputePassCount: number
  gpuSubmissionCount: number
  sdfGenerationTimeMs: number
}

export function regenerateGpuSdfChunks(options: {
  chunkCoords: Array<ChunkCoordinates>
  gpuSdfCache: GpuChunkSdfCache | null
  gpuSdfGenerator: GpuSdfGenerator | null
  gpuVoxelCache: GpuChunkVoxelCache | null
}): number {
  return regenerateGpuGeneratedChunkBuffers({
    chunkCoords: options.chunkCoords,
    gpuGeneratedCache: options.gpuSdfCache,
    gpuGenerator: options.gpuSdfGenerator,
    gpuVoxelCache: options.gpuVoxelCache,
  })
}

export function syncStreamedGpuSdfBuffers(
  options: SyncStreamedGpuSdfBuffersOptions
): SyncStreamedGpuSdfBuffersResult {
  const result = syncStreamedGpuGeneratedChunkBuffers({
    computePassesPerGeneratedChunk: 1,
    gpuGeneratedCache: options.gpuSdfCache,
    gpuGenerator: options.gpuSdfGenerator,
    gpuVoxelCache: options.gpuVoxelCache,
    update: options.update,
  })

  return {
    generatedChunkCount: result.generatedChunkCount,
    gpuComputePassCount: result.gpuComputePassCount,
    gpuSubmissionCount: result.gpuSubmissionCount,
    sdfGenerationTimeMs: result.generationTimeMs,
  }
}
