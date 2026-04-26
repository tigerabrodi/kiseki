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
  movementSpeed: number
  previousCameraPosition: THREE.Vector3
}

export function advanceDebugWorldCamera({
  camera,
  controls,
  currentCameraPosition,
  frame,
  inputState,
  movementSpeed,
  previousCameraPosition,
}: AdvanceDebugWorldCameraOptions): void {
  for (let step = 0; step < frame.steps; step += 1) {
    camera.position.copy(currentCameraPosition)
    camera.updateMatrix()
    previousCameraPosition.copy(currentCameraPosition)

    const movement = getFlyMovementIntent(inputState)
    controls.moveRight(movement.right * movementSpeed * frame.fixedDeltaSeconds)
    controls.moveForward(
      movement.forward * movementSpeed * frame.fixedDeltaSeconds
    )
    camera.position.y += movement.up * movementSpeed * frame.fixedDeltaSeconds

    currentCameraPosition.copy(camera.position)
  }

  if (frame.steps === 0) {
    previousCameraPosition.copy(currentCameraPosition)
  }

  camera.position.lerpVectors(
    previousCameraPosition,
    currentCameraPosition,
    frame.alpha
  )
  camera.updateMatrixWorld()
}
