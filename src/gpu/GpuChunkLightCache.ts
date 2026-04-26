import type { ChunkStreamUpdate } from '../world/ChunkStreamer.ts'
import {
  chunkKey,
  type ChunkCoordinates,
  type WorldChunkEntry,
} from '../world/World.ts'
import type { GpuLightBufferHandle } from './GpuLightSlab.ts'

type ChunkSyncUpdate = Pick<ChunkStreamUpdate, 'loaded' | 'unloaded'>
type CreateGpuLightBuffer = (entry: WorldChunkEntry) => GpuLightBufferHandle
type DestroyGpuLightBuffer = (handle: GpuLightBufferHandle) => void

export class GpuChunkLightCache {
  private readonly buffers = new Map<string, GpuLightBufferHandle>()
  private readonly createBuffer: CreateGpuLightBuffer
  private readonly destroyBuffer: DestroyGpuLightBuffer

  constructor(
    createBuffer: CreateGpuLightBuffer,
    destroyBuffer: DestroyGpuLightBuffer
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

  getBuffer(coords: ChunkCoordinates): GpuLightBufferHandle | undefined {
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
