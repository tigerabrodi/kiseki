import { describe, expect, it } from 'vitest'

import {
  CHUNK_FACE_DIRECTION_IDS,
  packVoxelVertex,
  unpackVoxelVertex,
} from './packedVoxelVertex.ts'

describe('packVoxelVertex', () => {
  it('round-trips the packed vertex layout', () => {
    const packed = packVoxelVertex({
      materialId: 23,
      normalDirection: CHUNK_FACE_DIRECTION_IDS.pz,
      x: 7,
      y: 11,
      z: 13,
    })

    expect(unpackVoxelVertex(packed)).toEqual({
      materialId: 23,
      normalDirection: CHUNK_FACE_DIRECTION_IDS.pz,
      x: 7,
      y: 11,
      z: 13,
    })
  })

  it('uses reserved overflow bits so chunk-edge coordinates can reach 32', () => {
    const packed = packVoxelVertex({
      materialId: 5,
      normalDirection: CHUNK_FACE_DIRECTION_IDS.py,
      x: 32,
      y: 32,
      z: 32,
    })

    expect(unpackVoxelVertex(packed)).toEqual({
      materialId: 5,
      normalDirection: CHUNK_FACE_DIRECTION_IDS.py,
      x: 32,
      y: 32,
      z: 32,
    })
  })
})
