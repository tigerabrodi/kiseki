export type VoxelMaterialComparison = {
  cpuMaterial: number | null
  gpuMaterial: number | null
  hasMatchingVoxelCount: boolean
  matches: boolean
  mismatchIndex: number | null
}

export function compareVoxelMaterials(
  cpuMaterials: ArrayLike<number>,
  gpuMaterials: ArrayLike<number>
): VoxelMaterialComparison {
  const hasMatchingVoxelCount = cpuMaterials.length === gpuMaterials.length
  const voxelCount = Math.min(cpuMaterials.length, gpuMaterials.length)

  for (let index = 0; index < voxelCount; index += 1) {
    const cpuMaterial = cpuMaterials[index] ?? null
    const gpuMaterial = gpuMaterials[index] ?? null

    if (cpuMaterial !== gpuMaterial) {
      return {
        cpuMaterial,
        gpuMaterial,
        hasMatchingVoxelCount,
        matches: false,
        mismatchIndex: index,
      }
    }
  }

  return {
    cpuMaterial: null,
    gpuMaterial: null,
    hasMatchingVoxelCount,
    matches: hasMatchingVoxelCount,
    mismatchIndex: hasMatchingVoxelCount ? null : voxelCount,
  }
}
