import { GPU_LIGHT_MAX_LEVEL } from '../gpu/lightStorageCodec.ts'

export const VOXEL_LIGHT_MIN_FACTOR = 0.45

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1)
}

export function calculateVoxelLightFactor(lightLevel: number): number {
  const normalizedLight = clamp01(lightLevel / GPU_LIGHT_MAX_LEVEL)

  return VOXEL_LIGHT_MIN_FACTOR + (1 - VOXEL_LIGHT_MIN_FACTOR) * normalizedLight
}
