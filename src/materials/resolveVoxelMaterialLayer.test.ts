import { describe, expect, it } from 'vitest'

import { resolveVoxelMaterialLayer } from './resolveVoxelMaterialLayer.ts'

describe('resolveVoxelMaterialLayer', () => {
  it('maps single-surface materials directly to atlas layers', () => {
    expect(resolveVoxelMaterialLayer(1, 'px')).toBe(0)
    expect(resolveVoxelMaterialLayer(2, 'py')).toBe(4)
    expect(resolveVoxelMaterialLayer(4, 'ny')).toBe(7)
    expect(resolveVoxelMaterialLayer(5, 'nz')).toBe(1)
  })

  it('maps grass to direction-specific atlas layers', () => {
    expect(resolveVoxelMaterialLayer(3, 'py')).toBe(5)
    expect(resolveVoxelMaterialLayer(3, 'ny')).toBe(4)
    expect(resolveVoxelMaterialLayer(3, 'px')).toBe(6)
    expect(resolveVoxelMaterialLayer(3, 'pz')).toBe(6)
  })

  it('maps outdoor feature materials to their atlas layers', () => {
    expect(resolveVoxelMaterialLayer(6, 'py')).toBe(16)
    expect(resolveVoxelMaterialLayer(6, 'ny')).toBe(16)
    expect(resolveVoxelMaterialLayer(6, 'px')).toBe(15)
    expect(resolveVoxelMaterialLayer(7, 'pz')).toBe(20)
    expect(resolveVoxelMaterialLayer(8, 'pz')).toBe(3)
  })
})
