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
  generateChunk(voxelHandle: GpuVoxelBufferHandle, handle: Handle): void
}

type RegenerateGpuGeneratedChunkBuffersOptions<Handle> = {
  chunkCoords: Array<ChunkCoordinates>
  gpuGeneratedCache: GeneratedChunkBufferCache<Handle> | null
  gpuGenerator: GeneratedChunkBufferGenerator<Handle> | null
  gpuVoxelCache: Pick<GpuChunkVoxelCache, 'getBuffer'> | null
}

type SyncStreamedGpuGeneratedChunkBuffersOptions<Handle> = {
  gpuGeneratedCache: GeneratedChunkBufferCache<Handle> | null
  gpuGenerator: GeneratedChunkBufferGenerator<Handle> | null
  gpuVoxelCache: Pick<GpuChunkVoxelCache, 'getBuffer'> | null
  update: ChunkSyncUpdate
}

export type SyncStreamedGpuGeneratedChunkBuffersResult = {
  generatedChunkCount: number
  generationTimeMs: number
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

  options.gpuGeneratedCache?.sync(options.update)

  const generatedChunkCount = regenerateGpuGeneratedChunkBuffers({
    chunkCoords: options.update.loaded.map((entry) => entry.coords),
    gpuGeneratedCache: options.gpuGeneratedCache,
    gpuGenerator: options.gpuGenerator,
    gpuVoxelCache: options.gpuVoxelCache,
  })

  return {
    generatedChunkCount,
    generationTimeMs: performance.now() - generationStartMs,
  }
}
