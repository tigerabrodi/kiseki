export type FlyInputState = {
  backward: boolean
  down: boolean
  forward: boolean
  left: boolean
  right: boolean
  up: boolean
}

export type FlyMovementIntent = {
  forward: number
  right: number
  up: number
}

export function getFlyMovementIntent(input: FlyInputState): FlyMovementIntent {
  const right = Number(input.right) - Number(input.left)
  const up = Number(input.up) - Number(input.down)
  const forward = Number(input.forward) - Number(input.backward)
  const length = Math.hypot(right, up, forward)

  if (length === 0) {
    return { forward: 0, right: 0, up: 0 }
  }

  return {
    forward: forward / length,
    right: right / length,
    up: up / length,
  }
}
