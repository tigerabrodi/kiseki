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
  mesh: GpuPoolRuntimeStats | null
  totalBufferCount: number
  totalReservedByteLength: number
  voxel: GpuPoolRuntimeStats | null
}

type BuildGpuAllocationSnapshotInput = {
  mesh: GpuPoolRuntimeStats | null
  voxel: GpuPoolRuntimeStats | null
}

export function buildGpuAllocationSnapshot(
  input: BuildGpuAllocationSnapshotInput
): GpuAllocationSnapshot {
  return {
    mesh: input.mesh,
    totalBufferCount:
      (input.mesh?.bufferCount ?? 0) + (input.voxel?.bufferCount ?? 0),
    totalReservedByteLength:
      (input.mesh?.reservedByteLength ?? 0) +
      (input.voxel?.reservedByteLength ?? 0),
    voxel: input.voxel,
  }
}
