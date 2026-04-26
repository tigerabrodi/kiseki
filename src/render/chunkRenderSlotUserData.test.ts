import * as THREE from 'three/webgpu'
import { describe, expect, it } from 'vitest'

import {
  getChunkLightSlotIndex,
  getChunkSdfSlotIndex,
  getChunkSlotIndex,
  setChunkRenderSlotIndices,
} from './chunkRenderSlotUserData.ts'

describe('chunk render slot user data', () => {
  it('falls back to chunk slot index for optional GPU field slots', () => {
    const object = new THREE.Object3D()

    setChunkRenderSlotIndices(object, { chunkSlotIndex: 12 })

    expect(getChunkSlotIndex(object)).toBe(12)
    expect(getChunkSdfSlotIndex(object)).toBe(12)
    expect(getChunkLightSlotIndex(object)).toBe(12)
  })

  it('supports separate SDF and light slot indices', () => {
    const object = new THREE.Object3D()

    setChunkRenderSlotIndices(object, {
      chunkSlotIndex: 4,
      lightSlotIndex: 6,
      sdfSlotIndex: 5,
    })

    expect(getChunkSlotIndex(object)).toBe(4)
    expect(getChunkSdfSlotIndex(object)).toBe(5)
    expect(getChunkLightSlotIndex(object)).toBe(6)
  })

  it('defaults missing or invalid metadata to slot zero', () => {
    const object = new THREE.Object3D()

    object.userData.chunkSlotIndex = 'not-a-number'

    expect(getChunkSlotIndex(null)).toBe(0)
    expect(getChunkSlotIndex(object)).toBe(0)
    expect(getChunkSdfSlotIndex(object)).toBe(0)
    expect(getChunkLightSlotIndex(object)).toBe(0)
  })
})
