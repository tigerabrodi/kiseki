import * as THREE from 'three/webgpu'
import { describe, expect, it, vi } from 'vitest'

import { advanceDebugWorldCamera } from './advanceDebugWorldCamera.ts'

function createCameraHarness() {
  const camera = new THREE.PerspectiveCamera()
  const currentCameraPosition = new THREE.Vector3()
  const previousCameraPosition = new THREE.Vector3()
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
    previousCameraPosition,
  }
}

describe('advanceDebugWorldCamera', () => {
  it('caps movement catch-up after a long frame', () => {
    const harness = createCameraHarness()

    advanceDebugWorldCamera({
      ...harness,
      frame: {
        alpha: 0,
        fixedDeltaSeconds: 1 / 60,
        frameTimeSeconds: 5 / 60,
        steps: 5,
      },
      inputState: {
        backward: false,
        down: false,
        forward: true,
        left: false,
        right: false,
        up: false,
      },
      maxMovementStepsPerFrame: 2,
      movementSpeed: 60,
    })

    expect(harness.controls.moveForward).toHaveBeenCalledTimes(2)
    expect(harness.currentCameraPosition.z).toBeCloseTo(-2)
    expect(harness.camera.position.z).toBeCloseTo(-2)
  })

  it('renders the current camera position on an exact fixed-step boundary', () => {
    const harness = createCameraHarness()

    advanceDebugWorldCamera({
      ...harness,
      frame: {
        alpha: 0,
        fixedDeltaSeconds: 1 / 60,
        frameTimeSeconds: 1 / 60,
        steps: 1,
      },
      inputState: {
        backward: false,
        down: false,
        forward: true,
        left: false,
        right: false,
        up: false,
      },
      movementSpeed: 60,
    })

    expect(harness.currentCameraPosition.z).toBeCloseTo(-1)
    expect(harness.camera.position.z).toBeCloseTo(-1)
  })
})
