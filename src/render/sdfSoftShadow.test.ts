import { describe, expect, it } from 'vitest'

import {
  calculateSdfSoftShadowFactor,
  SDF_SOFT_SHADOW_MIN_FACTOR,
} from './sdfSoftShadow.ts'

describe('calculateSdfSoftShadowFactor', () => {
  it('keeps open SDF probes fully lit', () => {
    expect(calculateSdfSoftShadowFactor([4.5, 8])).toBe(1)
  })

  it('softly darkens when either probe is close to nearby terrain', () => {
    expect(calculateSdfSoftShadowFactor([4.5, 0.5])).toBe(
      SDF_SOFT_SHADOW_MIN_FACTOR
    )
  })

  it('uses the nearest probe so partial cover gives a partial shadow', () => {
    const factor = calculateSdfSoftShadowFactor([2.5, 5])

    expect(factor).toBeGreaterThan(SDF_SOFT_SHADOW_MIN_FACTOR)
    expect(factor).toBeLessThan(1)
  })
})
