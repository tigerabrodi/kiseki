import * as THREE from 'three/webgpu'
import { describe, expect, it } from 'vitest'

import { getDebugChunkStreamingFocusPosition } from './getDebugChunkStreamingFocusPosition.ts'

const idleInput = {
  backward: false,
  down: false,
  forward: false,
  left: false,
  right: false,
  up: false,
}

describe('getDebugChunkStreamingFocusPosition', () => {
  it('stays on the camera position while idle', () => {
    const camera = new THREE.PerspectiveCamera()
    const position = new THREE.Vector3(10, 20, 30)

    expect(
      getDebugChunkStreamingFocusPosition({
        camera,
        inputState: idleInput,
        leadDistance: 32,
        position,
      }).toArray()
    ).toEqual([10, 20, 30])
  })

  it('prefetches ahead of forward movement', () => {
    const camera = new THREE.PerspectiveCamera()
    const position = new THREE.Vector3(10, 20, 30)
    camera.updateMatrixWorld()

    const focus = getDebugChunkStreamingFocusPosition({
      camera,
      inputState: {
        ...idleInput,
        forward: true,
      },
      leadDistance: 32,
      position,
    })

    expect(focus.x).toBeCloseTo(10)
    expect(focus.y).toBeCloseTo(20)
    expect(focus.z).toBeCloseTo(-2)
  })

  it('prefetches along normalized diagonal movement', () => {
    const camera = new THREE.PerspectiveCamera()
    const position = new THREE.Vector3(0, 0, 0)
    camera.updateMatrixWorld()

    const focus = getDebugChunkStreamingFocusPosition({
      camera,
      inputState: {
        ...idleInput,
        forward: true,
        right: true,
      },
      leadDistance: Math.sqrt(2),
      position,
    })

    expect(focus.x).toBeCloseTo(1)
    expect(focus.z).toBeCloseTo(-1)
  })
})
