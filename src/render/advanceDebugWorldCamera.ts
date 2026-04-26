import * as THREE from 'three/webgpu'

import type { FlyInputState } from '../camera/getFlyMovementIntent.ts'
import { getFlyMovementIntent } from '../camera/getFlyMovementIntent.ts'

type FlyControls = {
  moveForward(distance: number): void
  moveRight(distance: number): void
}

type AdvanceDebugWorldCameraOptions = {
  camera: THREE.PerspectiveCamera
  controls: FlyControls
  currentCameraPosition: THREE.Vector3
  frameTimeSeconds: number
  inputState: FlyInputState
  maxMovementDeltaSeconds?: number
  movementSpeed: number
}

export function advanceDebugWorldCamera({
  camera,
  controls,
  currentCameraPosition,
  frameTimeSeconds,
  inputState,
  maxMovementDeltaSeconds = 1 / 30,
  movementSpeed,
}: AdvanceDebugWorldCameraOptions): void {
  const movementDeltaSeconds = Math.min(
    Math.max(frameTimeSeconds, 0),
    maxMovementDeltaSeconds
  )
  const movement = getFlyMovementIntent(inputState)

  camera.position.copy(currentCameraPosition)
  camera.updateMatrix()

  controls.moveRight(movement.right * movementSpeed * movementDeltaSeconds)
  controls.moveForward(movement.forward * movementSpeed * movementDeltaSeconds)
  camera.position.y += movement.up * movementSpeed * movementDeltaSeconds

  currentCameraPosition.copy(camera.position)
  camera.updateMatrixWorld()
}
