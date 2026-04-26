import { uniform } from 'three/tsl'

import {
  createVoxelLookSettings,
  type VoxelLookSettings,
} from './voxelLookSettings.ts'

export function createVoxelMaterialLookUniforms(
  settings: VoxelLookSettings = createVoxelLookSettings()
) {
  return {
    ambientOcclusionStrength: uniform(settings.ambientOcclusionStrength),
    materialBrightness: uniform(settings.materialBrightness),
    materialSaturation: uniform(settings.materialSaturation),
    sdfShadowStrength: uniform(settings.sdfShadowStrength),
    voxelLightStrength: uniform(settings.voxelLightStrength),
  }
}

export type VoxelMaterialLookUniforms = ReturnType<
  typeof createVoxelMaterialLookUniforms
>

export function applyVoxelMaterialLookUniforms(
  uniforms: VoxelMaterialLookUniforms,
  settings: VoxelLookSettings
): void {
  uniforms.ambientOcclusionStrength.value = settings.ambientOcclusionStrength
  uniforms.materialBrightness.value = settings.materialBrightness
  uniforms.materialSaturation.value = settings.materialSaturation
  uniforms.sdfShadowStrength.value = settings.sdfShadowStrength
  uniforms.voxelLightStrength.value = settings.voxelLightStrength
}
