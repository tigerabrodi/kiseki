import { describe, expect, it } from 'vitest'

import { CHUNK_VOLUME, xyz2i } from '../voxel/chunk.ts'
import { calculateAxisSignedDistance } from './chunkSdfApproximation.ts'

describe('calculateAxisSignedDistance', () => {
  it('returns negative distances inside solids and positive distances in air', () => {
    const voxels = new Uint8Array(CHUNK_VOLUME)

    voxels[xyz2i(16, 16, 16)] = 1

    expect(calculateAxisSignedDistance(voxels, 16, 16, 16)).toBe(-0.5)
    expect(calculateAxisSignedDistance(voxels, 17, 16, 16)).toBe(0.5)
    expect(calculateAxisSignedDistance(voxels, 18, 16, 16)).toBe(1.5)
  })

  it('treats out-of-bounds chunk space as air for boundary solids', () => {
    const voxels = new Uint8Array(CHUNK_VOLUME)

    voxels[xyz2i(0, 0, 0)] = 1

    expect(calculateAxisSignedDistance(voxels, 0, 0, 0)).toBe(-0.5)
  })
})
