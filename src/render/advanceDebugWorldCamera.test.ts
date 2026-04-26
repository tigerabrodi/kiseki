import * as THREE from 'three/webgpu'
import { describe, expect, it, vi } from 'vitest'

import { advanceDebugWorldCamera } from './advanceDebugWorldCamera.ts'

function createCameraHarness() {
  const camera = new THREE.PerspectiveCamera()
  const currentCameraPosition = new THREE.Vector3()
  const controls = {
    moveForward: vi.fn((distance: number) => {
      camera.position.z -= distance
    }),
    moveRight: vi.fn((distance: number) => {
      camera.position.x += distance
    }),
  }

  return {
    camera,
    controls,
    currentCameraPosition,
  }
}

describe('advanceDebugWorldCamera', () => {
  it('moves every rendered frame using the frame delta', () => {
    const harness = createCameraHarness()

    advanceDebugWorldCamera({
      ...harness,
      frameTimeSeconds: 1 / 120,
      inputState: {
        backward: false,
        down: false,
        forward: true,
        left: false,
        right: false,
        up: false,
      },
      movementSpeed: 120,
    })

    expect(harness.controls.moveForward).toHaveBeenCalledTimes(1)
    expect(harness.currentCameraPosition.z).toBeCloseTo(-1)
    expect(harness.camera.position.z).toBeCloseTo(-1)
  })

  it('caps movement catch-up after a long frame', () => {
    const harness = createCameraHarness()

    advanceDebugWorldCamera({
      ...harness,
      frameTimeSeconds: 5 / 60,
      inputState: {
        backward: false,
        down: false,
        forward: true,
        left: false,
        right: false,
        up: false,
      },
      maxMovementDeltaSeconds: 1 / 30,
      movementSpeed: 60,
    })

    expect(harness.controls.moveForward).toHaveBeenCalledTimes(1)
    expect(harness.currentCameraPosition.z).toBeCloseTo(-2)
    expect(harness.camera.position.z).toBeCloseTo(-2)
  })
})
