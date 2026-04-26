import * as THREE from 'three/webgpu'
import { describe, expect, it } from 'vitest'

import {
  advanceChunkRevealFactors,
  getObjectChunkRevealFactor,
  resetObjectChunkReveal,
  setObjectChunkRevealFactor,
} from './chunkReveal.ts'

describe('chunk reveal factors', () => {
  it('defaults missing reveal state to fully visible', () => {
    expect(getObjectChunkRevealFactor(new THREE.Object3D())).toBe(1)
    expect(getObjectChunkRevealFactor(null)).toBe(1)
  })

  it('clamps explicitly stored reveal state', () => {
    const object = new THREE.Object3D()

    expect(setObjectChunkRevealFactor(object, -1)).toBe(0)
    expect(getObjectChunkRevealFactor(object)).toBe(0)

    expect(setObjectChunkRevealFactor(object, 2)).toBe(1)
    expect(getObjectChunkRevealFactor(object)).toBe(1)
  })

  it('advances reveal state over the requested duration', () => {
    const object = new THREE.Object3D()

    resetObjectChunkReveal(object)

    expect(advanceChunkRevealFactors([object], 0.25, 1)).toBe(1)
    expect(getObjectChunkRevealFactor(object)).toBe(0.25)

    expect(advanceChunkRevealFactors([object], 1, 1)).toBe(0)
    expect(getObjectChunkRevealFactor(object)).toBe(1)
  })
})
