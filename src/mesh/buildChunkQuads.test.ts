import { describe, expect, it } from 'vitest'

import { CHUNK_SIZE, Chunk } from '../voxel/chunk.ts'
import { buildChunkQuads } from './buildChunkQuads.ts'

function fillChunk(chunk: Chunk, materialId: number): void {
  for (let z = 0; z < CHUNK_SIZE; z += 1) {
    for (let y = 0; y < CHUNK_SIZE; y += 1) {
      for (let x = 0; x < CHUNK_SIZE; x += 1) {
        chunk.set(x, y, z, materialId)
      }
    }
  }
}

describe('buildChunkQuads', () => {
  it('emits six large square faces for a fully solid chunk', () => {
    const chunk = new Chunk()
    fillChunk(chunk, 1)

    const data = buildChunkQuads(chunk)

    expect(data.visibleFaceCount).toBe(6 * CHUNK_SIZE * CHUNK_SIZE)
    expect(data.quads).toHaveLength(6)
    expect(data.quads.every((quad) => quad.width === CHUNK_SIZE)).toBe(true)
    expect(data.quads.every((quad) => quad.height === CHUNK_SIZE)).toBe(true)
  })

  it('contains two 2 by 2 top and bottom rectangles for a 2 by 2 by 1 slab', () => {
    const chunk = new Chunk()

    for (let z = 0; z < 2; z += 1) {
      for (let x = 0; x < 2; x += 1) {
        chunk.set(x, 0, z, 1)
      }
    }

    const data = buildChunkQuads(chunk)
    const largeRectangles = data.quads.filter(
      (quad) => quad.width === 2 && quad.height === 2
    )

    expect(data.quads).toHaveLength(6)
    expect(largeRectangles).toHaveLength(2)
    expect(largeRectangles.map((quad) => quad.direction).sort()).toEqual([
      'ny',
      'py',
    ])
  })

  it('does not merge alternating materials on the top surface', () => {
    const chunk = new Chunk()

    for (let z = 0; z < 4; z += 1) {
      for (let x = 0; x < 4; x += 1) {
        const materialId = (x + z) % 2 === 0 ? 1 : 2
        chunk.set(x, 0, z, materialId)
      }
    }

    const data = buildChunkQuads(chunk)
    const topSurfaceQuads = data.quads.filter((quad) => quad.direction === 'py')

    expect(topSurfaceQuads).toHaveLength(16)
    expect(topSurfaceQuads.every((quad) => quad.width === 1)).toBe(true)
    expect(topSurfaceQuads.every((quad) => quad.height === 1)).toBe(true)
  })
})
