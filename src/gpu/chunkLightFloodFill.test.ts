import { describe, expect, it } from 'vitest'

import { xyz2i } from '../voxel/chunk.ts'
import { generateFloodFillLightLevels } from './chunkLightFloodFill.ts'
import { GPU_LIGHT_MAX_LEVEL } from './lightStorageCodec.ts'

describe('generateFloodFillLightLevels', () => {
  it('seeds full skylight through open vertical air columns', () => {
    const light = generateFloodFillLightLevels(new Uint8Array(32 * 32 * 32), 0)

    expect(light[xyz2i(16, 31, 16)]).toBe(GPU_LIGHT_MAX_LEVEL)
    expect(light[xyz2i(16, 16, 16)]).toBe(GPU_LIGHT_MAX_LEVEL)
    expect(light[xyz2i(16, 0, 16)]).toBe(GPU_LIGHT_MAX_LEVEL)
  })

  it('spills attenuated light under a skylight blocker', () => {
    const voxels = new Uint8Array(32 * 32 * 32)

    voxels[xyz2i(16, 30, 16)] = 1

    const light = generateFloodFillLightLevels(voxels, 2)

    expect(light[xyz2i(16, 31, 16)]).toBe(GPU_LIGHT_MAX_LEVEL)
    expect(light[xyz2i(16, 30, 16)]).toBe(0)
    expect(light[xyz2i(16, 29, 16)]).toBeGreaterThan(0)
    expect(light[xyz2i(16, 29, 16)]).toBeLessThan(GPU_LIGHT_MAX_LEVEL)
  })

  it('does not direct-light air below a local roof', () => {
    const voxels = new Uint8Array(32 * 32 * 32)

    for (let z = 15; z <= 17; z += 1) {
      for (let x = 15; x <= 17; x += 1) {
        voxels[xyz2i(x, 30, z)] = 1
      }
    }

    const light = generateFloodFillLightLevels(voxels, 0)

    expect(light[xyz2i(16, 30, 16)]).toBe(0)
    expect(light[xyz2i(16, 29, 16)]).toBe(0)
  })
})
