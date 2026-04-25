import { describe, expect, it } from 'vitest'

import { countActiveIndirectDraws } from './indirectDrawData.ts'

describe('indirectDrawData', () => {
  it('counts draw commands with non-zero index and instance counts', () => {
    expect(
      countActiveIndirectDraws(
        new Uint32Array([
          36, 1, 0, 0, 0, 0, 1, 36, 24, 0, 12, 0, 72, 48, 0, 18, 1, 108, 72, 0,
        ]),
        4
      )
    ).toBe(2)
  })
})
