import { describe, expect, it } from 'vitest'

import type { GpuVoxelBufferHandle } from '../gpu/GpuChunkVoxelCache.ts'
import { Chunk } from '../voxel/chunk.ts'
import {
  chunkKey,
  type ChunkCoordinates,
  type WorldChunkEntry,
} from '../world/World.ts'
import {
  regenerateGpuGeneratedChunkBuffers,
  syncStreamedGpuGeneratedChunkBuffers,
} from './syncStreamedGpuGeneratedChunkBuffers.ts'

type GeneratedHandle = {
  label: string
}

function entry(x: number): WorldChunkEntry {
  return {
    chunk: new Chunk(),
    coords: { x, y: 0, z: 0 },
  }
}

function voxelHandle(label: string): GpuVoxelBufferHandle {
  return {
    buffer: {} as GPUBuffer,
    byteLength: 4,
    byteOffset: 0,
    isSlabAllocated: true,
    label,
    slotIndex: 0,
    voxelCount: 1,
  }
}

describe('syncStreamedGpuGeneratedChunkBuffers', () => {
  it('regenerates only chunks that have both voxel and generated buffers', () => {
    const generated = new Map<string, GeneratedHandle>([
      ['1,0,0', { label: 'generated-1' }],
      ['2,0,0', { label: 'generated-2' }],
    ])
    const voxels = new Map<string, GpuVoxelBufferHandle>([
      ['1,0,0', voxelHandle('voxel-1')],
    ])
    const calls: Array<string> = []

    const count = regenerateGpuGeneratedChunkBuffers({
      chunkCoords: [
        { x: 1, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 },
      ],
      gpuGeneratedCache: {
        getBuffer: (coords) => generated.get(chunkKey(coords)),
        sync: () => {},
      },
      gpuGenerator: {
        generateChunk: (voxel, handle) =>
          calls.push(`${voxel.label}:${handle.label}`),
      },
      gpuVoxelCache: {
        getBuffer: (coords: ChunkCoordinates) => voxels.get(chunkKey(coords)),
      },
    })

    expect(count).toBe(1)
    expect(calls).toEqual(['voxel-1:generated-1'])
  })

  it('syncs the generated cache before regenerating loaded chunks', () => {
    const generated = new Map<string, GeneratedHandle>()
    const voxels = new Map<string, GpuVoxelBufferHandle>([
      ['1,0,0', voxelHandle('voxel-1')],
    ])
    const calls: Array<string> = []

    const result = syncStreamedGpuGeneratedChunkBuffers({
      computePassesPerGeneratedChunk: 7,
      gpuGeneratedCache: {
        getBuffer: (coords) => generated.get(chunkKey(coords)),
        sync: (update) => {
          for (const chunkEntry of update.loaded) {
            generated.set(chunkKey(chunkEntry.coords), {
              label: `generated-${chunkEntry.coords.x}`,
            })
          }
        },
      },
      gpuGenerator: {
        generateChunk: (voxel, handle) =>
          calls.push(`${voxel.label}:${handle.label}`),
      },
      gpuVoxelCache: {
        getBuffer: (coords: ChunkCoordinates) => voxels.get(chunkKey(coords)),
      },
      update: {
        loaded: [entry(1)],
        unloaded: [],
      },
    })

    expect(result.generatedChunkCount).toBe(1)
    expect(result.generationTimeMs).toBeGreaterThanOrEqual(0)
    expect(result.gpuComputePassCount).toBe(7)
    expect(result.gpuSubmissionCount).toBe(1)
    expect(calls).toEqual(['voxel-1:generated-1'])
  })
})
