import type { ChunkFaceDirection } from '../mesh/buildChunkQuads.ts'

const ATLAS_LAYER = {
  cobblestone: 1,
  dirt: 4,
  grassSide: 6,
  grassTop: 5,
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
    default:
      return ATLAS_LAYER.stone
  }
}
