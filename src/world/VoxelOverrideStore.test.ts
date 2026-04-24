import { describe, expect, it } from 'vitest'

import { Chunk } from '../voxel/chunk.ts'
import { VoxelOverrideStore } from './VoxelOverrideStore.ts'

describe('VoxelOverrideStore', () => {
  it('stores overrides by world voxel coordinate and applies them to chunks', () => {
    const overrides = new VoxelOverrideStore()
    const chunk = new Chunk()

    overrides.setVoxel({ x: 33, y: -1, z: 2 }, 5)

    expect(overrides.getVoxel({ x: 33, y: -1, z: 2 })).toBe(5)
    expect(
      overrides.applyToChunk({ x: 1, y: -1, z: 0 }, chunk).get(1, 31, 2)
    ).toBe(5)
  })

  it('tracks override counts without duplicating chunk entries', () => {
    const overrides = new VoxelOverrideStore()

    overrides.setVoxel({ x: 0, y: 0, z: 0 }, 5)
    overrides.setVoxel({ x: 1, y: 0, z: 0 }, 0)
    overrides.setVoxel({ x: 1, y: 0, z: 0 }, 4)

    expect(overrides.chunkCount()).toBe(1)
    expect(overrides.voxelCount()).toBe(2)
  })
})
