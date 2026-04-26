import * as THREE from 'three/webgpu'

import type { FlyInputState } from '../camera/getFlyMovementIntent.ts'
import { getFlyMovementIntent } from '../camera/getFlyMovementIntent.ts'
import type { FixedStepFrame } from '../core/FixedStepLoop.ts'

type FlyControls = {
  moveForward(distance: number): void
  moveRight(distance: number): void
}

type AdvanceDebugWorldCameraOptions = {
  camera: THREE.PerspectiveCamera
  controls: FlyControls
  currentCameraPosition: THREE.Vector3
  frame: FixedStepFrame
  inputState: FlyInputState
  maxMovementStepsPerFrame?: number
  movementSpeed: number
  previousCameraPosition: THREE.Vector3
}

export function advanceDebugWorldCamera({
  camera,
  controls,
  currentCameraPosition,
  frame,
  inputState,
  maxMovementStepsPerFrame = Number.POSITIVE_INFINITY,
  movementSpeed,
  previousCameraPosition,
}: AdvanceDebugWorldCameraOptions): void {
  const movement = getFlyMovementIntent(inputState)
  const maxStepCount = Math.max(0, Math.floor(maxMovementStepsPerFrame))
  const movementStepCount = Math.min(frame.steps, maxStepCount)

  for (let step = 0; step < movementStepCount; step += 1) {
    camera.position.copy(currentCameraPosition)
    camera.updateMatrix()
    previousCameraPosition.copy(currentCameraPosition)

    controls.moveRight(movement.right * movementSpeed * frame.fixedDeltaSeconds)
    controls.moveForward(
      movement.forward * movementSpeed * frame.fixedDeltaSeconds
    )
    camera.position.y += movement.up * movementSpeed * frame.fixedDeltaSeconds

    currentCameraPosition.copy(camera.position)
  }

  if (movementStepCount === 0) {
    previousCameraPosition.copy(currentCameraPosition)
  }

  const interpolationAlpha =
    movementStepCount > 0 && frame.alpha === 0 ? 1 : frame.alpha

  camera.position.lerpVectors(
    previousCameraPosition,
    currentCameraPosition,
    interpolationAlpha
  )
  camera.updateMatrixWorld()
}
