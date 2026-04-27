import type { GpuChunkVoxelCache } from '../gpu/GpuChunkVoxelCache.ts'
import type { GpuVoxelBufferHandle } from '../gpu/GpuChunkVoxelCache.ts'
import type { ChunkStreamUpdate } from '../world/ChunkStreamer.ts'
import type { ChunkCoordinates } from '../world/World.ts'

type ChunkSyncUpdate = Pick<ChunkStreamUpdate, 'loaded' | 'unloaded'>

type GeneratedChunkBufferCache<Handle> = {
  getBuffer(coords: ChunkCoordinates): Handle | undefined
  sync(update: ChunkSyncUpdate): void
}

type GeneratedChunkBufferGenerator<Handle> = {
  encodeGenerateChunk?: (
    encoder: GPUCommandEncoder,
    voxelHandle: GpuVoxelBufferHandle,
    handle: Handle
  ) => void
  generateChunk(voxelHandle: GpuVoxelBufferHandle, handle: Handle): void
}

type RegenerateGpuGeneratedChunkBuffersOptions<Handle> = {
  chunkCoords: Array<ChunkCoordinates>
  gpuGeneratedCache: GeneratedChunkBufferCache<Handle> | null
  gpuGenerator: GeneratedChunkBufferGenerator<Handle> | null
  gpuVoxelCache: Pick<GpuChunkVoxelCache, 'getBuffer'> | null
}

type SyncStreamedGpuGeneratedChunkBuffersOptions<Handle> = {
  computePassesPerGeneratedChunk: number
  encoder?: GPUCommandEncoder
  gpuGeneratedCache: GeneratedChunkBufferCache<Handle> | null
  gpuGenerator: GeneratedChunkBufferGenerator<Handle> | null
  gpuVoxelCache: Pick<GpuChunkVoxelCache, 'getBuffer'> | null
  update: ChunkSyncUpdate
}

export type SyncStreamedGpuGeneratedChunkBuffersResult = {
  generatedChunkCount: number
  generationTimeMs: number
  gpuComputePassCount: number
  gpuSubmissionCount: number
}

export function regenerateGpuGeneratedChunkBuffers<Handle>(
  options: RegenerateGpuGeneratedChunkBuffersOptions<Handle>
): number {
  const { gpuGeneratedCache, gpuGenerator, gpuVoxelCache } = options
  let generatedChunkCount = 0

  if (
    gpuGeneratedCache === null ||
    gpuGenerator === null ||
    gpuVoxelCache === null
  ) {
    return generatedChunkCount
  }

  for (const coords of options.chunkCoords) {
    const voxelHandle = gpuVoxelCache.getBuffer(coords)
    const generatedHandle = gpuGeneratedCache.getBuffer(coords)

    if (voxelHandle === undefined || generatedHandle === undefined) {
      continue
    }

    gpuGenerator.generateChunk(voxelHandle, generatedHandle)
    generatedChunkCount += 1
  }

  return generatedChunkCount
}

export function syncStreamedGpuGeneratedChunkBuffers<Handle>(
  options: SyncStreamedGpuGeneratedChunkBuffersOptions<Handle>
): SyncStreamedGpuGeneratedChunkBuffersResult {
  const generationStartMs = performance.now()
  const { gpuGeneratedCache, gpuGenerator, gpuVoxelCache } = options
  let fallbackSubmissionCount = 0
  let generatedChunkCount = 0

  gpuGeneratedCache?.sync(options.update)

  if (
    gpuGeneratedCache !== null &&
    gpuGenerator !== null &&
    gpuVoxelCache !== null
  ) {
    for (const entry of options.update.loaded) {
      const voxelHandle = gpuVoxelCache.getBuffer(entry.coords)
      const generatedHandle = gpuGeneratedCache.getBuffer(entry.coords)

      if (voxelHandle === undefined || generatedHandle === undefined) {
        continue
      }

      if (
        options.encoder !== undefined &&
        gpuGenerator.encodeGenerateChunk !== undefined
      ) {
        gpuGenerator.encodeGenerateChunk(
          options.encoder,
          voxelHandle,
          generatedHandle
        )
      } else {
        gpuGenerator.generateChunk(voxelHandle, generatedHandle)
        fallbackSubmissionCount += 1
      }

      generatedChunkCount += 1
    }
  }

  return {
    generatedChunkCount,
    generationTimeMs: performance.now() - generationStartMs,
    gpuComputePassCount:
      generatedChunkCount * options.computePassesPerGeneratedChunk,
    gpuSubmissionCount: fallbackSubmissionCount,
  }
}
