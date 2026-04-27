export type VoxelLookSettings = {
  ambientOcclusionStrength: number
  backgroundIntensity: number
  environmentIntensity: number
  exposure: number
  fillIntensity: number
  fogColor: string
  fogDensity: number
  materialBrightness: number
  materialSaturation: number
  sdfShadowStrength: number
  skyAmbientIntensity: number
  sunIntensity: number
  voxelLightStrength: number
}

export type VoxelLookPreset = {
  label: string
  settings: VoxelLookSettings
}

type NumericVoxelLookSettingKey = Exclude<keyof VoxelLookSettings, 'fogColor'>

const NUMBER_SETTING_LIMITS = {
  ambientOcclusionStrength: { max: 1, min: 0 },
  backgroundIntensity: { max: 1.4, min: 0 },
  environmentIntensity: { max: 1.8, min: 0 },
  exposure: { max: 1.8, min: 0.35 },
  fillIntensity: { max: 1.8, min: 0 },
  fogDensity: { max: 0.012, min: 0 },
  materialBrightness: { max: 1.65, min: 0.55 },
  materialSaturation: { max: 1.6, min: 0.25 },
  sdfShadowStrength: { max: 1, min: 0 },
  skyAmbientIntensity: { max: 1.4, min: 0 },
  sunIntensity: { max: 3.2, min: 0 },
  voxelLightStrength: { max: 1, min: 0 },
} satisfies Record<NumericVoxelLookSettingKey, { max: number; min: number }>

export const VOXEL_LOOK_PRESETS = {
  brightVoxel: {
    label: 'Bright Voxel',
    settings: {
      ambientOcclusionStrength: 0.34,
      backgroundIntensity: 0.7,
      environmentIntensity: 1.18,
      exposure: 1.1,
      fillIntensity: 0.78,
      fogColor: '#9eb5c7',
      fogDensity: 0.0022,
      materialBrightness: 1.17,
      materialSaturation: 1.08,
      sdfShadowStrength: 0.22,
      skyAmbientIntensity: 0.68,
      sunIntensity: 2.05,
      voxelLightStrength: 0.42,
    },
  },
  naturalOutdoor: {
    label: 'Natural Outdoor',
    settings: {
      ambientOcclusionStrength: 0.82,
      backgroundIntensity: 0.88,
      environmentIntensity: 0.88,
      exposure: 1,
      fillIntensity: 0.55,
      fogColor: '#94a1aa',
      fogDensity: 0.005,
      materialBrightness: 1.22,
      materialSaturation: 0.98,
      sdfShadowStrength: 0.51,
      skyAmbientIntensity: 0.5,
      sunIntensity: 1.7,
      voxelLightStrength: 0.62,
    },
  },
  moodyShooter: {
    label: 'Moody Shooter',
    settings: {
      ambientOcclusionStrength: 0.82,
      backgroundIntensity: 0.38,
      environmentIntensity: 0.76,
      exposure: 0.82,
      fillIntensity: 0.34,
      fogColor: '#657380',
      fogDensity: 0.0055,
      materialBrightness: 0.9,
      materialSaturation: 0.78,
      sdfShadowStrength: 0.82,
      skyAmbientIntensity: 0.32,
      sunIntensity: 1.2,
      voxelLightStrength: 0.8,
    },
  },
  flatDebug: {
    label: 'Flat Debug',
    settings: {
      ambientOcclusionStrength: 0,
      backgroundIntensity: 0.45,
      environmentIntensity: 0,
      exposure: 1,
      fillIntensity: 0,
      fogColor: '#8796a4',
      fogDensity: 0,
      materialBrightness: 1,
      materialSaturation: 1,
      sdfShadowStrength: 0,
      skyAmbientIntensity: 1,
      sunIntensity: 0,
      voxelLightStrength: 0,
    },
  },
} satisfies Record<string, VoxelLookPreset>

export type VoxelLookPresetId = keyof typeof VOXEL_LOOK_PRESETS

export const DEFAULT_VOXEL_LOOK_PRESET_ID =
  'naturalOutdoor' satisfies VoxelLookPresetId

export const VOXEL_LOOK_PRESET_OPTIONS = Object.entries(VOXEL_LOOK_PRESETS).map(
  ([id, preset]) => ({
    id: id as VoxelLookPresetId,
    label: preset.label,
  })
)

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function normalizeFogColor(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : '#8796a4'
}

export function getVoxelLookPresetSettings(
  presetId: VoxelLookPresetId
): VoxelLookSettings {
  return { ...VOXEL_LOOK_PRESETS[presetId].settings }
}

export function createVoxelLookSettings(
  overrides: Partial<VoxelLookSettings> = {},
  base: VoxelLookSettings = getVoxelLookPresetSettings(
    DEFAULT_VOXEL_LOOK_PRESET_ID
  )
): VoxelLookSettings {
  const settings: VoxelLookSettings = {
    ...base,
    ...overrides,
  }

  for (const key of Object.keys(
    NUMBER_SETTING_LIMITS
  ) as Array<NumericVoxelLookSettingKey>) {
    const limits = NUMBER_SETTING_LIMITS[key]

    settings[key] = clampNumber(settings[key], limits.min, limits.max)
  }

  settings.fogColor = normalizeFogColor(settings.fogColor)

  return settings
}
