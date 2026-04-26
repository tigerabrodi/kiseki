export const SDF_SOFT_SHADOW_DIRECTION = {
  x: -0.45,
  y: 0.85,
  z: -0.25,
} as const
export const SDF_SOFT_SHADOW_FAR_SAMPLE_DISTANCE = 5
export const SDF_SOFT_SHADOW_MIN_FACTOR = 0.82
export const SDF_SOFT_SHADOW_NEAR_DISTANCE = 0.5
export const SDF_SOFT_SHADOW_NEAR_SAMPLE_DISTANCE = 2
export const SDF_SOFT_SHADOW_OPEN_DISTANCE = 4.5

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1)
}

export function calculateSdfSoftShadowFactor(
  signedDistances: ReadonlyArray<number>
): number {
  if (signedDistances.length === 0) {
    return 1
  }

  const closestDistance = signedDistances.reduce(
    (closest, signedDistance) => Math.min(closest, Math.abs(signedDistance)),
    Number.POSITIVE_INFINITY
  )
  const openness = clamp01(
    (closestDistance - SDF_SOFT_SHADOW_NEAR_DISTANCE) /
      (SDF_SOFT_SHADOW_OPEN_DISTANCE - SDF_SOFT_SHADOW_NEAR_DISTANCE)
  )

  return (
    SDF_SOFT_SHADOW_MIN_FACTOR + (1 - SDF_SOFT_SHADOW_MIN_FACTOR) * openness
  )
}
