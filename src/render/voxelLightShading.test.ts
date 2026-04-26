import { describe, expect, it } from 'vitest'

import { GPU_LIGHT_MAX_LEVEL } from '../gpu/lightStorageCodec.ts'
import {
  calculateVoxelLightFactor,
  VOXEL_LIGHT_MIN_FACTOR,
} from './voxelLightShading.ts'

describe('calculateVoxelLightFactor', () => {
  it('keeps fully lit voxels at full brightness', () => {
    expect(calculateVoxelLightFactor(GPU_LIGHT_MAX_LEVEL)).toBe(1)
  })

  it('keeps unlit voxels visible but dark', () => {
    expect(calculateVoxelLightFactor(0)).toBe(VOXEL_LIGHT_MIN_FACTOR)
  })

  it('interpolates mid-range voxel light levels', () => {
    const factor = calculateVoxelLightFactor(GPU_LIGHT_MAX_LEVEL / 2)

    expect(factor).toBeGreaterThan(VOXEL_LIGHT_MIN_FACTOR)
    expect(factor).toBeLessThan(1)
  })
})
