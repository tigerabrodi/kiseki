import * as THREE from 'three/webgpu'

import type { DebugWorldLightingRig } from './createDebugWorldScene.ts'
import {
  applyVoxelMaterialLookUniforms,
  type VoxelMaterialLookUniforms,
} from './voxelLookMaterialUniforms.ts'
import type { VoxelLookSettings } from './voxelLookSettings.ts'

type ApplyVoxelLookOptions = {
  lightingRig: DebugWorldLightingRig
  materialUniforms: VoxelMaterialLookUniforms
  renderer: THREE.WebGPURenderer
  scene: THREE.Scene
}

export function applyVoxelLook(
  options: ApplyVoxelLookOptions,
  settings: VoxelLookSettings
): void {
  options.renderer.toneMapping = THREE.ACESFilmicToneMapping
  options.renderer.toneMappingExposure = settings.exposure

  options.scene.backgroundIntensity = settings.backgroundIntensity
  options.scene.environmentIntensity = settings.environmentIntensity
  options.scene.fog =
    settings.fogDensity > 0
      ? new THREE.FogExp2(settings.fogColor, settings.fogDensity)
      : null

  options.lightingRig.ambientLight.intensity = settings.skyAmbientIntensity
  options.lightingRig.sunLight.intensity = settings.sunIntensity
  options.lightingRig.fillLight.intensity = settings.fillIntensity

  applyVoxelMaterialLookUniforms(options.materialUniforms, settings)
}
