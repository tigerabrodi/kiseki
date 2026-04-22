import { describe, expect, it } from 'vitest'

import { FixedStepLoop } from './FixedStepLoop.ts'

describe('FixedStepLoop', () => {
  it('accumulates partial frames and exposes interpolation alpha', () => {
    const loop = new FixedStepLoop({ fixedDeltaSeconds: 1 / 60 })

    expect(loop.advance(0)).toMatchObject({ alpha: 0, steps: 0 })
    expect(loop.advance(1 / 120)).toMatchObject({ alpha: 0.5, steps: 0 })
    expect(loop.advance(1 / 60)).toMatchObject({ alpha: 0, steps: 1 })
  })

  it('runs multiple fixed updates when a frame is long enough', () => {
    const loop = new FixedStepLoop({ fixedDeltaSeconds: 1 / 60 })

    loop.advance(0)

    const frame = loop.advance(0.2)

    expect(frame.steps).toBe(12)
    expect(frame.alpha).toBe(0)
  })

  it('clamps huge frame times to avoid a runaway update spiral', () => {
    const loop = new FixedStepLoop({
      fixedDeltaSeconds: 1 / 60,
      maxFrameTimeSeconds: 0.25,
    })

    loop.advance(0)

    const frame = loop.advance(5)

    expect(frame.frameTimeSeconds).toBe(0.25)
    expect(frame.steps).toBe(15)
    expect(frame.alpha).toBe(0)
  })
})
