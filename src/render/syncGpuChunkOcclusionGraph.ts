import type { GpuChunkMeshCache } from '../gpu/GpuChunkMeshCache.ts'
import type { GpuChunkOcclusionCuller } from '../gpu/GpuChunkOcclusionCuller.ts'
import type { GpuChunkVoxelCache } from '../gpu/GpuChunkVoxelCache.ts'
import type { WorldChunkEntry } from '../world/World.ts'

type SyncGpuChunkOcclusionGraphOptions = {
  chunkEntries: Array<WorldChunkEntry>
  gpuChunkMeshCache: GpuChunkMeshCache | null
  gpuOcclusionCuller: GpuChunkOcclusionCuller | null
  gpuVoxelCache: GpuChunkVoxelCache | null
}

export function syncGpuChunkOcclusionGraph(
  options: SyncGpuChunkOcclusionGraphOptions
): void {
  const { gpuChunkMeshCache, gpuOcclusionCuller, gpuVoxelCache } = options

  if (
    gpuChunkMeshCache === null ||
    gpuOcclusionCuller === null ||
    gpuVoxelCache === null
  ) {
    return
  }

  const inputs = []
  let voxelBuffer: GPUBuffer | null = null

  for (const entry of options.chunkEntries) {
    const meshHandle = gpuChunkMeshCache.getMesh(entry.coords)
    const voxelHandle = gpuVoxelCache.getBuffer(entry.coords)

    if (meshHandle === undefined || voxelHandle === undefined) {
      continue
    }

    voxelBuffer ??= voxelHandle.buffer
    inputs.push({
      coords: entry.coords,
      meshSlotIndex: meshHandle.slotIndex,
      voxelByteOffset: voxelHandle.byteOffset,
    })
  }

  gpuOcclusionCuller.setVoxelBuffer(voxelBuffer)
  gpuOcclusionCuller.syncGraph(inputs)
}
