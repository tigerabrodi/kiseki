import type { ChunkFaceDirection } from '../mesh/buildChunkQuads.ts'

const ATLAS_LAYER = {
  andesite: 3,
  cobblestone: 1,
  dirt: 4,
  grassSide: 6,
  grassTop: 5,
  leaves: 20,
  oakLogSide: 15,
  oakLogTop: 16,
  sand: 7,
  stone: 0,
} as const

export function resolveVoxelMaterialLayer(
  materialId: number,
  direction: ChunkFaceDirection
): number {
  switch (materialId) {
    case 1:
      return ATLAS_LAYER.stone
    case 2:
      return ATLAS_LAYER.dirt
    case 3:
      if (direction === 'py') {
        return ATLAS_LAYER.grassTop
      }

      if (direction === 'ny') {
        return ATLAS_LAYER.dirt
      }

      return ATLAS_LAYER.grassSide
    case 4:
      return ATLAS_LAYER.sand
    case 5:
      return ATLAS_LAYER.cobblestone
    case 6:
      if (direction === 'py' || direction === 'ny') {
        return ATLAS_LAYER.oakLogTop
      }

      return ATLAS_LAYER.oakLogSide
    case 7:
      return ATLAS_LAYER.leaves
    case 8:
      return ATLAS_LAYER.andesite
    default:
      return ATLAS_LAYER.stone
  }
}
