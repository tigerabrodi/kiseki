import { describe, expect, it } from 'vitest'

import { CHUNK_SIZE, CHUNK_VOLUME, Chunk, i2xyz, xyz2i } from './chunk.ts'

describe('xyz2i', () => {
  it('maps the first voxel to index 0', () => {
    expect(xyz2i(0, 0, 0)).toBe(0)
  })

  it('maps the last voxel to index 32767', () => {
    expect(xyz2i(CHUNK_SIZE - 1, CHUNK_SIZE - 1, CHUNK_SIZE - 1)).toBe(
      CHUNK_VOLUME - 1,
    )
  })

  it('round trips with i2xyz for every voxel in the chunk', () => {
    for (let z = 0; z < CHUNK_SIZE; z += 1) {
      for (let y = 0; y < CHUNK_SIZE; y += 1) {
        for (let x = 0; x < CHUNK_SIZE; x += 1) {
          const index = xyz2i(x, y, z)
          expect(i2xyz(index)).toEqual({ x, y, z })
        }
      }
    }
  })
})

describe('Chunk', () => {
  it('starts with all voxels set to air', () => {
    const chunk = new Chunk()

    expect(chunk.voxels).toHaveLength(CHUNK_VOLUME)
    expect(chunk.voxels.every((value) => value === 0)).toBe(true)
  })

  it('sets and gets a voxel value', () => {
    const chunk = new Chunk()

    chunk.set(7, 11, 13, 42)

    expect(chunk.get(7, 11, 13)).toBe(42)
  })
})
