import { describe, expect, it } from 'vitest'

import { TerrainGenerator } from './TerrainGenerator.ts'

describe('TerrainGenerator', () => {
  it('produces identical chunk data for the same seed and chunk coordinates', () => {
    const generatorA = new TerrainGenerator({ seed: 'kiseki' })
    const generatorB = new TerrainGenerator({ seed: 'kiseki' })
    const coords = { x: 2, y: -1, z: 3 }

    const chunkA = generatorA.createChunk(coords)
    const chunkB = generatorB.createChunk(coords)

    expect([...chunkA.voxels]).toEqual([...chunkB.voxels])
  })
})
