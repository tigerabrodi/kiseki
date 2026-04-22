import { describe, expect, it } from 'vitest'

import { Chunk } from '../voxel/chunk.ts'
import { chunkKey, chunkOrigin, createChunkGrid } from './World.ts'

describe('World', () => {
  it('builds stable keys for chunk coordinates', () => {
    expect(chunkKey({ x: -1, y: 0, z: 2 })).toBe('-1,0,2')
  })

  it('converts chunk coordinates into world-space origins', () => {
    expect(chunkOrigin({ x: 1, y: -1, z: 2 })).toEqual({
      x: 32,
      y: -32,
      z: 64,
    })
  })

  it('creates a 3 by 3 by 3 chunk grid for radius 1', () => {
    const world = createChunkGrid(1, () => new Chunk())

    expect(world.entries()).toHaveLength(27)
    expect(world.getChunk({ x: -1, y: -1, z: -1 })).toBeInstanceOf(Chunk)
    expect(world.getChunk({ x: 1, y: 1, z: 1 })).toBeInstanceOf(Chunk)
  })
})
