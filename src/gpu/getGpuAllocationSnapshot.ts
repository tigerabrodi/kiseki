import {
  buildGpuAllocationSnapshot,
  type GpuAllocationSnapshot,
} from './buildGpuAllocationSnapshot.ts'
import type { GpuChunkMeshSlab } from './GpuChunkMeshSlab.ts'
import type { GpuVoxelSlab } from './GpuVoxelSlab.ts'

export function getGpuAllocationSnapshot(
  meshSlab: GpuChunkMeshSlab | null,
  voxelSlab: GpuVoxelSlab | null
): GpuAllocationSnapshot {
  return buildGpuAllocationSnapshot({
    mesh: meshSlab?.getRuntimeStats() ?? null,
    voxel: voxelSlab?.getRuntimeStats() ?? null,
  })
}
