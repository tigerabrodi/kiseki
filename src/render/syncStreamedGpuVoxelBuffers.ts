import type { GpuChunkVoxelCache } from '../gpu/GpuChunkVoxelCache.ts'
import type { GpuTerrainGenerator } from '../gpu/GpuTerrainGenerator.ts'
import type { ChunkStreamUpdate } from '../world/ChunkStreamer.ts'

type SyncStreamedGpuVoxelBuffersOptions = {
  encoder?: GPUCommandEncoder
  gpuTerrainGenerator: GpuTerrainGenerator | null
  gpuVoxelCache: GpuChunkVoxelCache | null
  update: Pick<ChunkStreamUpdate, 'loaded' | 'unloaded'>
}

export type SyncStreamedGpuVoxelBuffersResult = {
  generatedChunkCount: number
  gpuComputePassCount: number
  gpuSubmissionCount: number
  terrainGenerationTimeMs: number
}

export function syncStreamedGpuVoxelBuffers(
  options: SyncStreamedGpuVoxelBuffersOptions
): SyncStreamedGpuVoxelBuffersResult {
  const terrainGenerationStartMs = performance.now()

  options.gpuVoxelCache?.sync(options.update)

  if (options.gpuTerrainGenerator === null || options.gpuVoxelCache === null) {
    return {
      generatedChunkCount: 0,
      gpuComputePassCount: 0,
      gpuSubmissionCount: 0,
      terrainGenerationTimeMs: 0,
    }
  }

  for (const entry of options.update.loaded) {
    const voxelHandle = options.gpuVoxelCache.getBuffer(entry.coords)

    if (voxelHandle !== undefined) {
      if (options.encoder === undefined) {
        options.gpuTerrainGenerator.generateChunk(voxelHandle, entry.coords)
      } else {
        options.gpuTerrainGenerator.encodeGenerateChunk(
          options.encoder,
          voxelHandle,
          entry.coords
        )
      }
    }
  }

  return {
    generatedChunkCount: options.update.loaded.length,
    gpuComputePassCount: options.update.loaded.length,
    gpuSubmissionCount:
      options.encoder === undefined ? options.update.loaded.length : 0,
    terrainGenerationTimeMs: performance.now() - terrainGenerationStartMs,
  }
}
