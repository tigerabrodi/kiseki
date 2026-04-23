import { describe, expect, it, vi } from 'vitest'

import { Chunk } from '../voxel/chunk.ts'
import type { ChunkStreamUpdate } from '../world/ChunkStreamer.ts'
import type { WorldChunkEntry } from '../world/World.ts'
import {
  GpuChunkVoxelCache,
  type GpuVoxelBufferHandle,
} from './GpuChunkVoxelCache.ts'

function createEntry(x: number, y: number, z: number): WorldChunkEntry {
  return {
    chunk: new Chunk(),
    coords: { x, y, z },
  }
}

function createUpdate(
  loaded: Array<WorldChunkEntry>,
  unloaded: Array<WorldChunkEntry>
): Pick<ChunkStreamUpdate, 'loaded' | 'unloaded'> {
  return { loaded, unloaded }
}

describe('GpuChunkVoxelCache', () => {
  it('creates one GPU buffer per loaded chunk and totals their byte sizes', () => {
    const createBuffer = vi.fn(
      (entry: WorldChunkEntry): GpuVoxelBufferHandle =>
        ({
          buffer: {} as GPUBuffer,
          byteLength: 1024,
          label: `chunk_${entry.coords.x}_${entry.coords.y}_${entry.coords.z}`,
          voxelCount: 256,
        }) satisfies GpuVoxelBufferHandle
    )

    const cache = new GpuChunkVoxelCache(createBuffer, vi.fn())
    const loaded = [createEntry(0, 0, 0), createEntry(1, 0, 0)]

    cache.sync(createUpdate(loaded, []))

    expect(createBuffer).toHaveBeenCalledTimes(2)
    expect(cache.size()).toBe(2)
    expect(cache.totalBytes()).toBe(2048)
    expect(cache.getBuffer({ x: 1, y: 0, z: 0 })?.label).toBe('chunk_1_0_0')
  })

  it('destroys buffers for unloaded chunks and keeps survivors', () => {
    const destroyBuffer = vi.fn()
    const cache = new GpuChunkVoxelCache(
      (entry) =>
        ({
          buffer: {} as GPUBuffer,
          byteLength: 512,
          label: `chunk_${entry.coords.x}`,
          voxelCount: 128,
        }) satisfies GpuVoxelBufferHandle,
      destroyBuffer
    )

    const origin = createEntry(0, 0, 0)
    const east = createEntry(1, 0, 0)

    cache.sync(createUpdate([origin, east], []))
    cache.sync(createUpdate([], [origin]))

    expect(destroyBuffer).toHaveBeenCalledTimes(1)
    expect(cache.size()).toBe(1)
    expect(cache.getBuffer({ x: 0, y: 0, z: 0 })).toBeUndefined()
    expect(cache.getBuffer({ x: 1, y: 0, z: 0 })?.label).toBe('chunk_1')
  })

  it('ignores duplicate loads for chunks that already have GPU buffers', () => {
    const createBuffer = vi.fn(
      (): GpuVoxelBufferHandle =>
        ({
          buffer: {} as GPUBuffer,
          byteLength: 256,
          label: 'chunk',
          voxelCount: 64,
        }) satisfies GpuVoxelBufferHandle
    )

    const cache = new GpuChunkVoxelCache(createBuffer, vi.fn())
    const entry = createEntry(0, 0, 0)

    cache.sync(createUpdate([entry], []))
    cache.sync(createUpdate([entry], []))

    expect(createBuffer).toHaveBeenCalledTimes(1)
    expect(cache.size()).toBe(1)
  })
})
