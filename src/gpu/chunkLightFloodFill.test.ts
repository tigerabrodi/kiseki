import { describe, expect, it } from 'vitest'

import { xyz2i } from '../voxel/chunk.ts'
import { generateFloodFillLightLevels } from './chunkLightFloodFill.ts'
import { GPU_LIGHT_MAX_LEVEL } from './lightStorageCodec.ts'

describe('generateFloodFillLightLevels', () => {
  it('seeds skylight along open top voxels', () => {
    const light = generateFloodFillLightLevels(new Uint8Array(32 * 32 * 32), 0)

    expect(light[xyz2i(16, 31, 16)]).toBe(GPU_LIGHT_MAX_LEVEL)
    expect(light[xyz2i(16, 30, 16)]).toBe(0)
  })

  it('propagates light through neighboring air voxels', () => {
    const light = generateFloodFillLightLevels(new Uint8Array(32 * 32 * 32), 2)

    expect(light[xyz2i(16, 30, 16)]).toBe(GPU_LIGHT_MAX_LEVEL - 1)
    expect(light[xyz2i(16, 29, 16)]).toBe(GPU_LIGHT_MAX_LEVEL - 2)
  })

  it('blocks propagation through solid voxels', () => {
    const voxels = new Uint8Array(32 * 32 * 32)

    voxels[xyz2i(16, 30, 16)] = 1

    const light = generateFloodFillLightLevels(voxels, 4)

    expect(light[xyz2i(16, 30, 16)]).toBe(0)
    expect(light[xyz2i(16, 29, 16)]).toBeLessThan(GPU_LIGHT_MAX_LEVEL - 2)
  })
})
