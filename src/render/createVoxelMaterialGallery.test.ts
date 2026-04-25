import { describe, expect, it } from 'vitest'

import { createVoxelMaterialGalleryEntries } from './createVoxelMaterialGallery.ts'
import type { VoxelTextureAtlasManifest } from './loadVoxelTextureAtlas.ts'

describe('createVoxelMaterialGalleryEntries', () => {
  it('sorts atlas materials by layer for predictable visual inspection', () => {
    const atlas = {
      cellSize: 512,
      format: 'ktx2_array',
      layerCount: 3,
      materials: {
        grass: { layer: 2 },
        stone: { layer: 0 },
        dirt: { layer: 1 },
      },
      mipmaps: true,
      version: 2,
    } satisfies VoxelTextureAtlasManifest

    expect(createVoxelMaterialGalleryEntries(atlas)).toEqual([
      { layer: 0, name: 'stone' },
      { layer: 1, name: 'dirt' },
      { layer: 2, name: 'grass' },
    ])
  })
})
