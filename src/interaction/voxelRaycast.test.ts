import { describe, expect, it } from 'vitest'

import { raycastVoxels } from './voxelRaycast.ts'

describe('raycastVoxels', () => {
  it('hits the first solid voxel along the ray and returns the placement face', () => {
    const hit = raycastVoxels(
      { x: 0.5, y: 0.5, z: 0.5 },
      { x: 1, y: 0, z: 0 },
      5,
      ({ x, y, z }) => (x === 2 && y === 0 && z === 0 ? 5 : 0)
    )

    expect(hit).toEqual({
      distance: 1.5,
      hitVoxel: { x: 2, y: 0, z: 0 },
      materialId: 5,
      normal: { x: -1, y: 0, z: 0 },
      placementVoxel: { x: 1, y: 0, z: 0 },
    })
  })

  it('handles negative ray directions', () => {
    const hit = raycastVoxels(
      { x: 3.5, y: 0.5, z: 0.5 },
      { x: -1, y: 0, z: 0 },
      5,
      ({ x, y, z }) => (x === 1 && y === 0 && z === 0 ? 2 : 0)
    )

    expect(hit).toEqual({
      distance: 1.5,
      hitVoxel: { x: 1, y: 0, z: 0 },
      materialId: 2,
      normal: { x: 1, y: 0, z: 0 },
      placementVoxel: { x: 2, y: 0, z: 0 },
    })
  })

  it('returns null when no voxel is hit within range', () => {
    expect(
      raycastVoxels(
        { x: 0.5, y: 0.5, z: 0.5 },
        { x: 0, y: 0, z: 1 },
        3,
        () => 0
      )
    ).toBeNull()
  })
})
