import type { GpuChunkLightCache } from '../gpu/GpuChunkLightCache.ts'
import type { GpuChunkVoxelCache } from '../gpu/GpuChunkVoxelCache.ts'
import type { GpuLightGenerator } from '../gpu/GpuLightGenerator.ts'
import type { ChunkStreamUpdate } from '../world/ChunkStreamer.ts'
import type { ChunkCoordinates } from '../world/World.ts'
import {
  regenerateGpuGeneratedChunkBuffers,
  syncStreamedGpuGeneratedChunkBuffers,
} from './syncStreamedGpuGeneratedChunkBuffers.ts'

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
    gpuGeneratedCache: options.gpuLightCache,
    gpuGenerator: options.gpuLightGenerator,
    gpuVoxelCache: options.gpuVoxelCache,
    update: options.update,
  })

  return {
    generatedChunkCount: result.generatedChunkCount,
    lightGenerationTimeMs: result.generationTimeMs,
  }
}
