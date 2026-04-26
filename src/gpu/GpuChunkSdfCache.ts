import type { ChunkStreamUpdate } from '../world/ChunkStreamer.ts'
import {
  chunkKey,
  type ChunkCoordinates,
  type WorldChunkEntry,
} from '../world/World.ts'
import type { GpuSdfBufferHandle } from './GpuSdfSlab.ts'

type ChunkSyncUpdate = Pick<ChunkStreamUpdate, 'loaded' | 'unloaded'>
type CreateGpuSdfBuffer = (entry: WorldChunkEntry) => GpuSdfBufferHandle
type DestroyGpuSdfBuffer = (handle: GpuSdfBufferHandle) => void

export class GpuChunkSdfCache {
  private readonly buffers = new Map<string, GpuSdfBufferHandle>()
  private readonly createBuffer: CreateGpuSdfBuffer
  private readonly destroyBuffer: DestroyGpuSdfBuffer

  constructor(
    createBuffer: CreateGpuSdfBuffer,
    destroyBuffer: DestroyGpuSdfBuffer
  ) {
    this.createBuffer = createBuffer
    this.destroyBuffer = destroyBuffer
  }

  dispose(): void {
    for (const buffer of this.buffers.values()) {
      this.destroyBuffer(buffer)
    }

    this.buffers.clear()
  }

  getBuffer(coords: ChunkCoordinates): GpuSdfBufferHandle | undefined {
    return this.buffers.get(chunkKey(coords))
  }

  size(): number {
    return this.buffers.size
  }

  sync(update: ChunkSyncUpdate): void {
    for (const entry of update.unloaded) {
      const key = chunkKey(entry.coords)
      const buffer = this.buffers.get(key)

      if (buffer === undefined) {
        continue
      }

      this.destroyBuffer(buffer)
      this.buffers.delete(key)
    }

    for (const entry of update.loaded) {
      const key = chunkKey(entry.coords)

      if (this.buffers.has(key)) {
        continue
      }

      this.buffers.set(key, this.createBuffer(entry))
    }
  }

  totalBytes(): number {
    let total = 0

    for (const buffer of this.buffers.values()) {
      total += buffer.byteLength
    }

    return total
  }
}
