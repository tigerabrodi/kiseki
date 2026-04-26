import { describe, expect, it } from 'vitest'

import {
  calculateSdfAmbientOcclusionFactor,
  SDF_AO_MIN_FACTOR,
} from './sdfAmbientOcclusion.ts'

describe('calculateSdfAmbientOcclusionFactor', () => {
  it('darkens samples right next to nearby terrain mass', () => {
    expect(calculateSdfAmbientOcclusionFactor(0.5)).toBe(SDF_AO_MIN_FACTOR)
    expect(calculateSdfAmbientOcclusionFactor(-0.5)).toBe(SDF_AO_MIN_FACTOR)
  })

  it('returns full ambient light once the SDF probe is open enough', () => {
    expect(calculateSdfAmbientOcclusionFactor(3)).toBe(1)
    expect(calculateSdfAmbientOcclusionFactor(8)).toBe(1)
  })

  it('ramps smoothly between tight and open SDF samples', () => {
    const factor = calculateSdfAmbientOcclusionFactor(1.75)

    expect(factor).toBeGreaterThan(SDF_AO_MIN_FACTOR)
    expect(factor).toBeLessThan(1)
  })
})
