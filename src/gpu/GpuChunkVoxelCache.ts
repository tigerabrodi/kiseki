import type { ChunkStreamUpdate } from '../world/ChunkStreamer.ts'
import {
  chunkKey,
  type ChunkCoordinates,
  type WorldChunkEntry,
} from '../world/World.ts'

export type GpuVoxelBufferHandle = {
  buffer: GPUBuffer
  byteOffset: number
  byteLength: number
  isSlabAllocated: boolean
  label: string
  slotIndex: number
  voxelCount: number
}

type ChunkSyncUpdate = Pick<ChunkStreamUpdate, 'loaded' | 'unloaded'>
type CreateGpuVoxelBuffer = (entry: WorldChunkEntry) => GpuVoxelBufferHandle
type DestroyGpuVoxelBuffer = (handle: GpuVoxelBufferHandle) => void

export class GpuChunkVoxelCache {
  private readonly buffers = new Map<string, GpuVoxelBufferHandle>()
  private readonly createBuffer: CreateGpuVoxelBuffer
  private readonly destroyBuffer: DestroyGpuVoxelBuffer

  constructor(
    createBuffer: CreateGpuVoxelBuffer,
    destroyBuffer: DestroyGpuVoxelBuffer
  ) {
    this.createBuffer = createBuffer
    this.destroyBuffer = destroyBuffer
  }

  getBuffer(coords: ChunkCoordinates): GpuVoxelBufferHandle | undefined {
    return this.buffers.get(chunkKey(coords))
  }

  size(): number {
    return this.buffers.size
  }

  dispose(): void {
    for (const buffer of this.buffers.values()) {
      this.destroyBuffer(buffer)
    }

    this.buffers.clear()
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
