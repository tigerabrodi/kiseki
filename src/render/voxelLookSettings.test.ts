import { describe, expect, it } from 'vitest'

import {
  createVoxelLookSettings,
  getVoxelLookPresetSettings,
} from './voxelLookSettings.ts'

describe('voxelLookSettings', () => {
  it('returns independent preset settings copies', () => {
    const first = getVoxelLookPresetSettings('naturalOutdoor')
    const second = getVoxelLookPresetSettings('naturalOutdoor')

    first.exposure = 0.5

    expect(second.exposure).toBe(1)
  })

  it('clamps numeric values to the supported look range', () => {
    const settings = createVoxelLookSettings({
      ambientOcclusionStrength: 2,
      exposure: -1,
      fogDensity: 99,
      materialBrightness: 99,
      sunIntensity: -10,
    })

    expect(settings.ambientOcclusionStrength).toBe(1)
    expect(settings.exposure).toBe(0.35)
    expect(settings.fogDensity).toBe(0.012)
    expect(settings.materialBrightness).toBe(1.65)
    expect(settings.sunIntensity).toBe(0)
  })

  it('normalizes invalid fog colors to the outdoor default', () => {
    expect(createVoxelLookSettings({ fogColor: 'misty' }).fogColor).toBe(
      '#8796a4'
    )
    expect(createVoxelLookSettings({ fogColor: '#ABCDEF' }).fogColor).toBe(
      '#abcdef'
    )
  })
})
