import type { GpuChunkLightCache } from '../gpu/GpuChunkLightCache.ts'
import type { GpuChunkVoxelCache } from '../gpu/GpuChunkVoxelCache.ts'
import type { GpuLightGenerator } from '../gpu/GpuLightGenerator.ts'
import { GPU_LIGHT_PROPAGATION_ITERATIONS } from '../gpu/lightStorageCodec.ts'
import type { ChunkStreamUpdate } from '../world/ChunkStreamer.ts'
import type { ChunkCoordinates } from '../world/World.ts'
import {
  regenerateGpuGeneratedChunkBuffers,
  syncStreamedGpuGeneratedChunkBuffers,
} from './syncStreamedGpuGeneratedChunkBuffers.ts'

type SyncStreamedGpuLightBuffersOptions = {
  encoder?: GPUCommandEncoder
  gpuLightCache: GpuChunkLightCache | null
  gpuLightGenerator: GpuLightGenerator | null
  gpuVoxelCache: GpuChunkVoxelCache | null
  update: Pick<ChunkStreamUpdate, 'loaded' | 'unloaded'>
}

export type SyncStreamedGpuLightBuffersResult = {
  generatedChunkCount: number
  gpuComputePassCount: number
  gpuSubmissionCount: number
  lightGenerationTimeMs: number
}

export function regenerateGpuLightChunks(options: {
  chunkCoords: Array<ChunkCoordinates>
  gpuLightCache: GpuChunkLightCache | null
  gpuLightGenerator: GpuLightGenerator | null
  gpuVoxelCache: GpuChunkVoxelCache | null
}): number {
  return regenerateGpuGeneratedChunkBuffers({
    chunkCoords: options.chunkCoords,
    gpuGeneratedCache: options.gpuLightCache,
    gpuGenerator: options.gpuLightGenerator,
    gpuVoxelCache: options.gpuVoxelCache,
  })
}

export function syncStreamedGpuLightBuffers(
  options: SyncStreamedGpuLightBuffersOptions
): SyncStreamedGpuLightBuffersResult {
  const result = syncStreamedGpuGeneratedChunkBuffers({
    computePassesPerGeneratedChunk: 1 + GPU_LIGHT_PROPAGATION_ITERATIONS,
    encoder: options.encoder,
    gpuGeneratedCache: options.gpuLightCache,
    gpuGenerator: options.gpuLightGenerator,
    gpuVoxelCache: options.gpuVoxelCache,
    update: options.update,
  })

  return {
    generatedChunkCount: result.generatedChunkCount,
    gpuComputePassCount: result.gpuComputePassCount,
    gpuSubmissionCount: result.gpuSubmissionCount,
    lightGenerationTimeMs: result.generationTimeMs,
  }
}
