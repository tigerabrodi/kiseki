import {
  buildGpuAllocationSnapshot,
  type GpuAllocationSnapshot,
} from './buildGpuAllocationSnapshot.ts'
import type { GpuChunkMeshSlab } from './GpuChunkMeshSlab.ts'
import type { GpuLightSlab } from './GpuLightSlab.ts'
import type { GpuSdfSlab } from './GpuSdfSlab.ts'
import type { GpuVoxelSlab } from './GpuVoxelSlab.ts'

export function getGpuAllocationSnapshot(
  meshSlab: GpuChunkMeshSlab | null,
  voxelSlab: GpuVoxelSlab | null,
  sdfSlab: GpuSdfSlab | null = null,
  lightSlab: GpuLightSlab | null = null
): GpuAllocationSnapshot {
  return buildGpuAllocationSnapshot({
    light: lightSlab?.getRuntimeStats() ?? null,
    mesh: meshSlab?.getRuntimeStats() ?? null,
    sdf: sdfSlab?.getRuntimeStats() ?? null,
    voxel: voxelSlab?.getRuntimeStats() ?? null,
  })
}
