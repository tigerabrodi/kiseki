export type GpuPoolRuntimeStats = {
  activeByteLength: number
  activeCount: number
  allocationCount: number
  availableCount: number
  bufferCount: number
  capacity: number
  highWaterCount: number
  releaseCount: number
  reservedByteLength: number
}

export type GpuAllocationSnapshot = {
  light: GpuPoolRuntimeStats | null
  mesh: GpuPoolRuntimeStats | null
  sdf: GpuPoolRuntimeStats | null
  totalBufferCount: number
  totalReservedByteLength: number
  voxel: GpuPoolRuntimeStats | null
}

type BuildGpuAllocationSnapshotInput = {
  light?: GpuPoolRuntimeStats | null
  mesh?: GpuPoolRuntimeStats | null
  sdf?: GpuPoolRuntimeStats | null
  voxel?: GpuPoolRuntimeStats | null
}

export function buildGpuAllocationSnapshot(
  input: BuildGpuAllocationSnapshotInput
): GpuAllocationSnapshot {
  const light = input.light ?? null
  const mesh = input.mesh ?? null
  const sdf = input.sdf ?? null
  const voxel = input.voxel ?? null

  return {
    light,
    mesh,
    sdf,
    totalBufferCount:
      (light?.bufferCount ?? 0) +
      (mesh?.bufferCount ?? 0) +
      (sdf?.bufferCount ?? 0) +
      (voxel?.bufferCount ?? 0),
    totalReservedByteLength:
      (light?.reservedByteLength ?? 0) +
      (mesh?.reservedByteLength ?? 0) +
      (sdf?.reservedByteLength ?? 0) +
      (voxel?.reservedByteLength ?? 0),
    voxel,
  }
}
