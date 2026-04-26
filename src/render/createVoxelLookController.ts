import type * as THREE from 'three/webgpu'

import { applyVoxelLook } from './applyVoxelLook.ts'
import type { DebugWorldLightingRig } from './createDebugWorldScene.ts'
import {
  installVoxelLookControls,
  type VoxelLookControlsHandle,
} from './installVoxelLookControls.ts'
import {
  createVoxelMaterialLookUniforms,
  type VoxelMaterialLookUniforms,
} from './voxelLookMaterialUniforms.ts'
import {
  createVoxelLookSettings,
  DEFAULT_VOXEL_LOOK_PRESET_ID,
  getVoxelLookPresetSettings,
  VOXEL_LOOK_PRESET_OPTIONS,
  type VoxelLookPresetId,
  type VoxelLookSettings,
} from './voxelLookSettings.ts'

type CreateVoxelLookControllerOptions = {
  lightingRig: DebugWorldLightingRig
  renderer: THREE.WebGPURenderer
  root: HTMLElement
  scene: THREE.Scene
}

export type VoxelLookController = {
  applyDefaultPreset: () => VoxelLookSettings
  disposeControls: () => void
  getInfo: () => {
    presetId: VoxelLookPresetId | 'custom'
    presets: typeof VOXEL_LOOK_PRESET_OPTIONS
    settings: VoxelLookSettings
  }
  installControls: () => void
  materialUniforms: VoxelMaterialLookUniforms
  setPreset: (presetId: VoxelLookPresetId) => VoxelLookSettings
  setSettings: (settings: Partial<VoxelLookSettings>) => VoxelLookSettings
}

export function createVoxelLookController(
  options: CreateVoxelLookControllerOptions
): VoxelLookController {
  let presetId: VoxelLookPresetId | null = DEFAULT_VOXEL_LOOK_PRESET_ID
  let settings = getVoxelLookPresetSettings(DEFAULT_VOXEL_LOOK_PRESET_ID)
  let controls: VoxelLookControlsHandle | null = null
  const materialUniforms = createVoxelMaterialLookUniforms(settings)
  const applySettings = (
    nextSettings: Partial<VoxelLookSettings>,
    nextPresetId: VoxelLookPresetId | null
  ): VoxelLookSettings => {
    settings = createVoxelLookSettings(nextSettings, settings)
    presetId = nextPresetId
    applyVoxelLook(
      {
        lightingRig: options.lightingRig,
        materialUniforms,
        renderer: options.renderer,
        scene: options.scene,
      },
      settings
    )
    controls?.sync(settings, presetId)

    return { ...settings }
  }
  const applyPreset = (nextPresetId: VoxelLookPresetId): VoxelLookSettings =>
    applySettings(getVoxelLookPresetSettings(nextPresetId), nextPresetId)

  return {
    applyDefaultPreset: () => applyPreset(DEFAULT_VOXEL_LOOK_PRESET_ID),
    disposeControls: (): void => {
      controls?.dispose()
      controls = null
    },
    getInfo: () => ({
      presetId: presetId ?? 'custom',
      presets: VOXEL_LOOK_PRESET_OPTIONS,
      settings: { ...settings },
    }),
    installControls: (): void => {
      controls?.dispose()
      controls = installVoxelLookControls({
        initialPresetId: presetId,
        initialSettings: settings,
        onPresetChange: applyPreset,
        onSettingsChange: (nextSettings) => applySettings(nextSettings, null),
        root: options.root,
      })
    },
    materialUniforms,
    setPreset: applyPreset,
    setSettings: (nextSettings) => applySettings(nextSettings, null),
  }
}
