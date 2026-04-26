import * as THREE from 'three/webgpu'
import { describe, expect, it } from 'vitest'

import {
  getObjectVoxelMaterialDebugModeId,
  getVoxelMaterialDebugModeId,
  readVoxelMaterialDebugMode,
  setVoxelMaterialDebugMode,
  VOXEL_MATERIAL_DEBUG_MODES,
} from './voxelMaterialDebugMode.ts'

describe('voxelMaterialDebugMode', () => {
  it('uses final shading by default', () => {
    const material = new THREE.MeshBasicMaterial()

    expect(readVoxelMaterialDebugMode(material)).toBe('final')
    expect(
      getObjectVoxelMaterialDebugModeId(new THREE.Mesh(undefined, material))
    ).toBe(getVoxelMaterialDebugModeId('final'))
  })

  it('stores supported debug modes on material userData', () => {
    const material = new THREE.MeshBasicMaterial()

    for (const mode of VOXEL_MATERIAL_DEBUG_MODES) {
      expect(setVoxelMaterialDebugMode(material, mode)).toBe(mode)
      expect(readVoxelMaterialDebugMode(material)).toBe(mode)
      expect(
        getObjectVoxelMaterialDebugModeId(new THREE.Mesh(undefined, material))
      ).toBe(getVoxelMaterialDebugModeId(mode))
    }
  })

  it('falls back to final for invalid userData values', () => {
    const material = new THREE.MeshBasicMaterial()

    material.userData.voxelMaterialDebugMode = 'sparkles'

    expect(readVoxelMaterialDebugMode(material)).toBe('final')
  })
})
