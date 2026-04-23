import { describe, expect, it, vi } from 'vitest'

import type { WorldChunkEntry } from '../world/World.ts'
import { Chunk } from '../voxel/chunk.ts'
import { GpuChunkMeshCache } from './GpuChunkMeshCache.ts'
import type { GpuChunkMeshHandle } from './GpuChunkMesher.ts'

function createMeshHandle(
  label: string,
  byteLength: number
): GpuChunkMeshHandle {
  return {
    countsBuffer: {} as GPUBuffer,
    countsByteLength: 16,
    indirectBuffer: {} as GPUBuffer,
    indirectByteLength: 20,
    indexBuffer: {} as GPUBuffer,
    indexByteLength: byteLength,
    label,
    maxFaceCount: 0,
    maxIndexCount: 0,
    maxVertexCount: 0,
    vertexBuffer: {} as GPUBuffer,
    vertexByteLength: byteLength / 2,
  }
}

describe('GpuChunkMeshCache', () => {
  it('rebuilds the cache from world entries', () => {
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

    cache.rebuild([entryA, entryB])

    expect(createMesh).toHaveBeenCalledTimes(2)
    expect(cache.size()).toBe(2)
    expect(cache.getMesh(entryA.coords)?.label).toBe('mesh_0,0,0')
    expect(cache.totalBytes()).toBe((16 + 20 + 48 + 24) * 2)
    expect(destroyMesh).not.toHaveBeenCalled()
  })

  it('disposes previous handles before replacing them', () => {
    const firstMesh = createMeshHandle('first', 48)
    const secondMesh = createMeshHandle('second', 96)
    const createMesh = vi
      .fn()
      .mockReturnValueOnce(firstMesh)
      .mockReturnValueOnce(secondMesh)
    const destroyMesh = vi.fn()
    const cache = new GpuChunkMeshCache(createMesh, destroyMesh)
    const entry = {
      chunk: new Chunk(),
      coords: { x: 0, y: 0, z: 0 },
    }

    cache.rebuild([entry])
    cache.rebuild([entry])

    expect(destroyMesh).toHaveBeenCalledWith(firstMesh)
    expect(cache.getMesh(entry.coords)).toBe(secondMesh)
  })
})
