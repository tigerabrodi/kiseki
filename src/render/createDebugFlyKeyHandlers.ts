import type { FlyInputState } from '../camera/getFlyMovementIntent.ts'

export function createDebugFlyKeyHandlers(inputState: FlyInputState): {
  handleKeyDown: (event: KeyboardEvent) => void
  handleKeyUp: (event: KeyboardEvent) => void
} {
  const onKeyChange =
    (pressed: boolean) =>
    (event: KeyboardEvent): void => {
      switch (event.code) {
        case 'KeyW':
          inputState.forward = pressed
          break
        case 'KeyS':
          inputState.backward = pressed
          break
        case 'KeyA':
          inputState.left = pressed
          break
        case 'KeyD':
          inputState.right = pressed
          break
        case 'Space':
          inputState.up = pressed
          break
        case 'ShiftLeft':
        case 'ShiftRight':
          inputState.down = pressed
          break
        default:
          return
      }

      event.preventDefault()
    }

  return {
    handleKeyDown: onKeyChange(true),
    handleKeyUp: onKeyChange(false),
  }
}
