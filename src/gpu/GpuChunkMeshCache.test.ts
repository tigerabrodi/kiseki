import { describe, expect, it, vi } from 'vitest'

import type { ChunkStreamUpdate } from '../world/ChunkStreamer.ts'
import type { WorldChunkEntry } from '../world/World.ts'
import { Chunk } from '../voxel/chunk.ts'
import { GpuChunkMeshCache } from './GpuChunkMeshCache.ts'
import type { GpuChunkMeshHandle } from './GpuChunkMesher.ts'

function createMeshHandle(
  label: string,
  byteLength: number
): GpuChunkMeshHandle {
  return {
    baseVertex: 0,
    countsByteOffset: 0,
    countsBuffer: {} as GPUBuffer,
    countsByteLength: 16,
    firstIndex: 0,
    indexByteOffset: 0,
    indirectBuffer: {} as GPUBuffer,
    indirectByteLength: 20,
    indirectByteOffset: 0,
    indexBuffer: {} as GPUBuffer,
    indexByteLength: byteLength,
    isSlabAllocated: false,
    label,
    maxFaceCount: 0,
    maxIndexCount: 0,
    maxVertexCount: 0,
    slotIndex: 0,
    vertexByteOffset: 0,
    vertexBuffer: {} as GPUBuffer,
    vertexByteLength: byteLength / 2,
  }
}

function createUpdate(
  loaded: Array<WorldChunkEntry>,
  unloaded: Array<WorldChunkEntry>
): Pick<ChunkStreamUpdate, 'loaded' | 'unloaded'> {
  return { loaded, unloaded }
}

describe('GpuChunkMeshCache', () => {
  it('creates one mesh handle per loaded chunk and totals their byte sizes', () => {
    const createMesh = vi
      .fn()
      .mockImplementation((entry: WorldChunkEntry) =>
        createMeshHandle(
          `mesh_${entry.coords.x},${entry.coords.y},${entry.coords.z}`,
          48
        )
      )
    const destroyMesh = vi.fn()
    const cache = new GpuChunkMeshCache(createMesh, destroyMesh)
    const entryA = {
      chunk: new Chunk(),
      coords: { x: 0, y: 0, z: 0 },
    }
    const entryB = {
      chunk: new Chunk(),
      coords: { x: 1, y: 0, z: 0 },
    }

    cache.sync(createUpdate([entryA, entryB], []))

    expect(createMesh).toHaveBeenCalledTimes(2)
    expect(cache.size()).toBe(2)
    expect(cache.getMesh(entryA.coords)?.label).toBe('mesh_0,0,0')
    expect(cache.totalBytes()).toBe((16 + 20 + 48 + 24) * 2)
    expect(destroyMesh).not.toHaveBeenCalled()
  })

  it('destroys unloaded handles while keeping surviving mesh slots stable', () => {
    const firstMesh = createMeshHandle('first', 48)
    const secondMesh = createMeshHandle('second', 96)
    const thirdMesh = createMeshHandle('third', 64)
    const createMesh = vi
      .fn()
      .mockReturnValueOnce(firstMesh)
      .mockReturnValueOnce(secondMesh)
      .mockReturnValueOnce(thirdMesh)
    const destroyMesh = vi.fn()
    const cache = new GpuChunkMeshCache(createMesh, destroyMesh)
    const origin = {
      chunk: new Chunk(),
      coords: { x: 0, y: 0, z: 0 },
    }
    const east = {
      chunk: new Chunk(),
      coords: { x: 1, y: 0, z: 0 },
    }
    const north = {
      chunk: new Chunk(),
      coords: { x: 0, y: 0, z: 1 },
    }

    cache.sync(createUpdate([origin, east], []))
    cache.sync(createUpdate([north, east], [origin]))

    expect(destroyMesh).toHaveBeenCalledTimes(1)
    expect(destroyMesh).toHaveBeenCalledWith(firstMesh)
    expect(cache.getMesh(origin.coords)).toBeUndefined()
    expect(cache.getMesh(east.coords)).toBe(secondMesh)
    expect(cache.getMesh(north.coords)).toBe(thirdMesh)
    expect(createMesh).toHaveBeenCalledTimes(3)
  })

  it('ignores duplicate loads for chunks that already have mesh handles', () => {
    const createMesh = vi.fn().mockReturnValue(createMeshHandle('mesh', 64))
    const cache = new GpuChunkMeshCache(createMesh, vi.fn())
    const origin = {
      chunk: new Chunk(),
      coords: { x: 0, y: 0, z: 0 },
    }

    cache.sync(createUpdate([origin], []))
    cache.sync(createUpdate([origin], []))

    expect(createMesh).toHaveBeenCalledTimes(1)
    expect(cache.size()).toBe(1)
  })
})
