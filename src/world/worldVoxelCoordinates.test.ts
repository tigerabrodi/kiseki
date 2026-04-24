import { describe, expect, it } from 'vitest'

import {
  getAffectedChunkCoordsForLocalVoxel,
  getLocalVoxelIndex,
  localVoxelToWorldVoxel,
  worldVoxelToChunkVoxel,
} from './worldVoxelCoordinates.ts'

describe('worldVoxelCoordinates', () => {
  it('maps world voxels into chunk and local voxel coordinates', () => {
    expect(worldVoxelToChunkVoxel({ x: 31, y: 31, z: 31 })).toEqual({
      chunkCoords: { x: 0, y: 0, z: 0 },
      localCoords: { x: 31, y: 31, z: 31 },
    })

    expect(worldVoxelToChunkVoxel({ x: 32, y: -1, z: -33 })).toEqual({
      chunkCoords: { x: 1, y: -1, z: -2 },
      localCoords: { x: 0, y: 31, z: 31 },
    })
  })

  it('round-trips local voxel coordinates back into world space', () => {
    const chunkCoords = { x: -2, y: 1, z: 3 }
    const localCoords = { x: 7, y: 15, z: 30 }

    expect(localVoxelToWorldVoxel(chunkCoords, localCoords)).toEqual({
      x: -57,
      y: 47,
      z: 126,
    })
  })

  it('returns the local chunk index for a voxel coordinate', () => {
    expect(getLocalVoxelIndex({ x: 0, y: 0, z: 0 })).toBe(0)
    expect(getLocalVoxelIndex({ x: 31, y: 31, z: 31 })).toBe(32767)
  })

  it('includes face-neighbor chunks when a voxel edit touches chunk borders', () => {
    expect(
      getAffectedChunkCoordsForLocalVoxel(
        { x: 4, y: -2, z: 7 },
        { x: 0, y: 31, z: 12 }
      )
    ).toEqual([
      { x: 4, y: -2, z: 7 },
      { x: 3, y: -2, z: 7 },
      { x: 4, y: -1, z: 7 },
    ])
  })
})
