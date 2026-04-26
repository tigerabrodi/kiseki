import {
  createVoxelLookSettings,
  getVoxelLookPresetSettings,
  VOXEL_LOOK_PRESET_OPTIONS,
  type VoxelLookPresetId,
  type VoxelLookSettings,
} from './voxelLookSettings.ts'

const CUSTOM_PRESET_VALUE = 'custom'

type VoxelLookControlKey = Exclude<keyof VoxelLookSettings, 'fogColor'>

type VoxelLookControlDefinition = {
  key: VoxelLookControlKey
  label: string
  max: number
  min: number
  step: number
}

const VOXEL_LOOK_CONTROL_DEFINITIONS: Array<VoxelLookControlDefinition> = [
  { key: 'exposure', label: 'Exposure', max: 1.8, min: 0.35, step: 0.01 },
  { key: 'sunIntensity', label: 'Sun', max: 3.2, min: 0, step: 0.01 },
  { key: 'skyAmbientIntensity', label: 'Sky', max: 1.4, min: 0, step: 0.01 },
  { key: 'fillIntensity', label: 'Fill', max: 1.8, min: 0, step: 0.01 },
  { key: 'environmentIntensity', label: 'HDR', max: 1.8, min: 0, step: 0.01 },
  {
    key: 'ambientOcclusionStrength',
    label: 'AO',
    max: 1,
    min: 0,
    step: 0.01,
  },
  {
    key: 'sdfShadowStrength',
    label: 'SDF shadow',
    max: 1,
    min: 0,
    step: 0.01,
  },
  {
    key: 'voxelLightStrength',
    label: 'Voxel light',
    max: 1,
    min: 0,
    step: 0.01,
  },
  {
    key: 'materialBrightness',
    label: 'Brightness',
    max: 1.65,
    min: 0.55,
    step: 0.01,
  },
  {
    key: 'materialSaturation',
    label: 'Saturation',
    max: 1.6,
    min: 0.25,
    step: 0.01,
  },
  { key: 'fogDensity', label: 'Fog', max: 0.012, min: 0, step: 0.0001 },
]

type InstallVoxelLookControlsOptions = {
  initialPresetId: VoxelLookPresetId | null
  initialSettings: VoxelLookSettings
  onPresetChange: (presetId: VoxelLookPresetId) => void
  onSettingsChange: (settings: VoxelLookSettings) => void
  root: HTMLElement
}

export type VoxelLookControlsHandle = {
  dispose: () => void
  sync: (
    settings: VoxelLookSettings,
    presetId: VoxelLookPresetId | null
  ) => void
}

function formatLookControlValue(key: keyof VoxelLookSettings, value: number) {
  return key === 'fogDensity' ? value.toFixed(4) : value.toFixed(2)
}

function createOption(value: string, label: string): HTMLOptionElement {
  const option = document.createElement('option')

  option.value = value
  option.textContent = label

  return option
}

export function installVoxelLookControls(
  options: InstallVoxelLookControlsOptions
): VoxelLookControlsHandle {
  const presetSelect = options.root.querySelector<HTMLSelectElement>(
    '[data-voxel-look-preset]'
  )
  const controlsContainer = options.root.querySelector<HTMLElement>(
    '[data-voxel-look-controls]'
  )

  if (presetSelect === null || controlsContainer === null) {
    throw new Error('Failed to mount voxel look controls')
  }

  let currentSettings = createVoxelLookSettings(options.initialSettings)
  const disposers: Array<() => void> = []
  const inputs = new Map<keyof VoxelLookSettings, HTMLInputElement>()
  const outputs = new Map<keyof VoxelLookSettings, HTMLOutputElement>()

  presetSelect.append(createOption(CUSTOM_PRESET_VALUE, 'Custom'))

  for (const preset of VOXEL_LOOK_PRESET_OPTIONS) {
    presetSelect.append(createOption(preset.id, preset.label))
  }

  for (const definition of VOXEL_LOOK_CONTROL_DEFINITIONS) {
    const control = document.createElement('label')
    const header = document.createElement('span')
    const output = document.createElement('output')
    const input = document.createElement('input')

    control.className = 'look-control'
    header.textContent = definition.label
    output.dataset.voxelLookOutput = definition.key
    input.dataset.voxelLookControl = definition.key
    input.max = String(definition.max)
    input.min = String(definition.min)
    input.step = String(definition.step)
    input.type = 'range'

    control.append(header, output, input)
    controlsContainer.append(control)
    inputs.set(definition.key, input)
    outputs.set(definition.key, output)

    const handleInput = (): void => {
      currentSettings = createVoxelLookSettings(
        {
          ...currentSettings,
          [definition.key]: Number(input.value),
        },
        currentSettings
      )
      presetSelect.value = CUSTOM_PRESET_VALUE
      output.value = formatLookControlValue(
        definition.key,
        currentSettings[definition.key]
      )
      options.onSettingsChange(currentSettings)
    }

    input.addEventListener('input', handleInput)
    disposers.push(() => input.removeEventListener('input', handleInput))
  }

  const fogColorLabel = document.createElement('label')
  const fogColorHeader = document.createElement('span')
  const fogColorInput = document.createElement('input')

  fogColorLabel.className = 'look-control look-control--color'
  fogColorHeader.textContent = 'Fog color'
  fogColorInput.dataset.voxelLookControl = 'fogColor'
  fogColorInput.type = 'color'
  fogColorLabel.append(fogColorHeader, fogColorInput)
  controlsContainer.append(fogColorLabel)
  inputs.set('fogColor', fogColorInput)

  const handleFogColorInput = (): void => {
    currentSettings = createVoxelLookSettings(
      {
        ...currentSettings,
        fogColor: fogColorInput.value,
      },
      currentSettings
    )
    presetSelect.value = CUSTOM_PRESET_VALUE
    options.onSettingsChange(currentSettings)
  }

  fogColorInput.addEventListener('input', handleFogColorInput)
  disposers.push(() =>
    fogColorInput.removeEventListener('input', handleFogColorInput)
  )

  const sync = (
    settings: VoxelLookSettings,
    presetId: VoxelLookPresetId | null
  ): void => {
    currentSettings = createVoxelLookSettings(settings)
    presetSelect.value = presetId ?? CUSTOM_PRESET_VALUE

    for (const definition of VOXEL_LOOK_CONTROL_DEFINITIONS) {
      const input = inputs.get(definition.key)
      const output = outputs.get(definition.key)

      if (input !== undefined) {
        input.value = String(currentSettings[definition.key])
      }

      if (output !== undefined) {
        output.value = formatLookControlValue(
          definition.key,
          currentSettings[definition.key]
        )
      }
    }

    const fogColorInput = inputs.get('fogColor')

    if (fogColorInput !== undefined) {
      fogColorInput.value = currentSettings.fogColor
    }
  }

  const handlePresetChange = (): void => {
    const presetId = presetSelect.value

    if (presetId === CUSTOM_PRESET_VALUE) {
      options.onSettingsChange(currentSettings)
      return
    }

    options.onPresetChange(presetId as VoxelLookPresetId)
    sync(
      getVoxelLookPresetSettings(presetId as VoxelLookPresetId),
      presetId as VoxelLookPresetId
    )
  }

  presetSelect.addEventListener('change', handlePresetChange)
  disposers.push(() =>
    presetSelect.removeEventListener('change', handlePresetChange)
  )

  sync(options.initialSettings, options.initialPresetId)

  return {
    dispose: (): void => {
      for (const dispose of disposers) {
        dispose()
      }

      presetSelect.replaceChildren()
      controlsContainer.replaceChildren()
    },
    sync,
  }
}
