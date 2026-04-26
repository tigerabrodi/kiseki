export const SDF_AO_MIN_FACTOR = 0.74
export const SDF_AO_NEAR_SURFACE_DISTANCE = 0.5
export const SDF_AO_SAMPLE_DISTANCE = 3

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1)
}

export function calculateSdfAmbientOcclusionFactor(
  signedDistance: number
): number {
  const openness = clamp01(
    (Math.abs(signedDistance) - SDF_AO_NEAR_SURFACE_DISTANCE) /
      (SDF_AO_SAMPLE_DISTANCE - SDF_AO_NEAR_SURFACE_DISTANCE)
  )

  return SDF_AO_MIN_FACTOR + (1 - SDF_AO_MIN_FACTOR) * openness
}
