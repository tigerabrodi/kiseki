import type { ChunkStreamUpdate } from '../world/ChunkStreamer.ts'
import {
  chunkKey,
  type ChunkCoordinates,
  type WorldChunkEntry,
} from '../world/World.ts'

type ChunkSyncUpdate = Pick<ChunkStreamUpdate, 'loaded' | 'unloaded'>
type CreateGpuChunkBuffer<Handle> = (entry: WorldChunkEntry) => Handle
type DestroyGpuChunkBuffer<Handle> = (handle: Handle) => void

export type GpuChunkBufferHandle = {
  byteLength: number
}

export class GpuChunkBufferCache<Handle extends GpuChunkBufferHandle> {
  private readonly buffers = new Map<string, Handle>()
  private readonly createBuffer: CreateGpuChunkBuffer<Handle>
  private readonly destroyBuffer: DestroyGpuChunkBuffer<Handle>

  constructor(
    createBuffer: CreateGpuChunkBuffer<Handle>,
    destroyBuffer: DestroyGpuChunkBuffer<Handle>
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

  getBuffer(coords: ChunkCoordinates): Handle | undefined {
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
