import * as THREE from 'three/webgpu'

import type { FlyInputState } from '../camera/getFlyMovementIntent.ts'
import { getFlyMovementIntent } from '../camera/getFlyMovementIntent.ts'

const DEFAULT_FORWARD = new THREE.Vector3(0, 0, -1)
const RIGHT = new THREE.Vector3()
const FORWARD = new THREE.Vector3()
const STREAMING_OFFSET = new THREE.Vector3()

type GetDebugChunkStreamingFocusPositionOptions = {
  camera: THREE.Camera
  inputState: FlyInputState
  leadDistance: number
  position: THREE.Vector3
  target?: THREE.Vector3
}

export function getDebugChunkStreamingFocusPosition({
  camera,
  inputState,
  leadDistance,
  position,
  target = new THREE.Vector3(),
}: GetDebugChunkStreamingFocusPositionOptions): THREE.Vector3 {
  const movement = getFlyMovementIntent(inputState)

  target.copy(position)

  if (leadDistance <= 0 || (movement.forward === 0 && movement.right === 0)) {
    return target
  }

  RIGHT.setFromMatrixColumn(camera.matrixWorld, 0)
  FORWARD.copy(DEFAULT_FORWARD).applyQuaternion(camera.quaternion)
  FORWARD.y = 0

  if (FORWARD.lengthSq() > 0) {
    FORWARD.normalize()
  } else {
    FORWARD.copy(DEFAULT_FORWARD)
  }

  STREAMING_OFFSET.copy(RIGHT)
    .multiplyScalar(movement.right)
    .addScaledVector(FORWARD, movement.forward)

  if (STREAMING_OFFSET.lengthSq() === 0) {
    return target
  }

  STREAMING_OFFSET.normalize().multiplyScalar(leadDistance)

  return target.add(STREAMING_OFFSET)
}
