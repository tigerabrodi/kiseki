import { describe, expect, it } from 'vitest'

import {
  getFlyMovementIntent,
  type FlyInputState,
} from './getFlyMovementIntent.ts'

function createInputState(
  overrides: Partial<FlyInputState> = {}
): FlyInputState {
  return {
    backward: false,
    down: false,
    forward: false,
    left: false,
    right: false,
    up: false,
    ...overrides,
  }
}

describe('getFlyMovementIntent', () => {
  it('returns zero movement when no keys are pressed', () => {
    expect(getFlyMovementIntent(createInputState())).toEqual({
      forward: 0,
      right: 0,
      up: 0,
    })
  })

  it('returns a unit forward vector for forward movement', () => {
    expect(getFlyMovementIntent(createInputState({ forward: true }))).toEqual({
      forward: 1,
      right: 0,
      up: 0,
    })
  })

  it('normalizes diagonal movement so speed stays consistent', () => {
    const movement = getFlyMovementIntent(
      createInputState({ forward: true, right: true, up: true })
    )

    expect(
      Math.hypot(movement.forward, movement.right, movement.up)
    ).toBeCloseTo(1)
    expect(movement.forward).toBeCloseTo(1 / Math.sqrt(3))
    expect(movement.right).toBeCloseTo(1 / Math.sqrt(3))
    expect(movement.up).toBeCloseTo(1 / Math.sqrt(3))
  })
})
