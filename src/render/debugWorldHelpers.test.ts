import { describe, expect, it } from 'vitest'

import { getPipelineState } from './debugWorldHelpers.ts'

describe('getPipelineState', () => {
  it('reports the most advanced active GPU render path', () => {
    expect(getPipelineState(false, true, true)).toBe('Mixed')
    expect(getPipelineState(true, false, false)).toBe('GPU Full')
    expect(getPipelineState(true, true, false)).toBe('GPU Full + Cull')
    expect(getPipelineState(true, true, true)).toBe('GPU Full + Indirect')
  })
})
