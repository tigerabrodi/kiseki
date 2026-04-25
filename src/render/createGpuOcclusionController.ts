import type { GpuChunkMeshCache } from '../gpu/GpuChunkMeshCache.ts'
import type { GpuChunkOcclusionCuller } from '../gpu/GpuChunkOcclusionCuller.ts'
import type { GpuChunkVoxelCache } from '../gpu/GpuChunkVoxelCache.ts'
import type { WorldChunkEntry } from '../world/World.ts'
import { syncGpuChunkOcclusionGraph } from './syncGpuChunkOcclusionGraph.ts'

type CreateGpuOcclusionControllerOptions = {
  getChunkEntries: () => Array<WorldChunkEntry>
  getGpuChunkMeshCache: () => GpuChunkMeshCache | null
  getGpuOcclusionCuller: () => GpuChunkOcclusionCuller | null
  getGpuVoxelCache: () => GpuChunkVoxelCache | null
  getPlayerMeshSlotIndex: () => number | null
}

export type GpuOcclusionController = {
  cullIfNeeded: () => void
  syncGraph: () => void
}

export function createGpuOcclusionController(
  options: CreateGpuOcclusionControllerOptions
): GpuOcclusionController {
  let isDirty = true
  let lastPlayerSlotIndex: number | null = null

  return {
    cullIfNeeded(): void {
      const gpuOcclusionCuller = options.getGpuOcclusionCuller()
      const playerSlotIndex = options.getPlayerMeshSlotIndex()

      if (
        gpuOcclusionCuller === null ||
        (!isDirty && playerSlotIndex === lastPlayerSlotIndex)
      ) {
        return
      }

      gpuOcclusionCuller.cull(playerSlotIndex)
      lastPlayerSlotIndex = playerSlotIndex
      isDirty = false
    },

    syncGraph(): void {
      syncGpuChunkOcclusionGraph({
        chunkEntries: options.getChunkEntries(),
        gpuChunkMeshCache: options.getGpuChunkMeshCache(),
        gpuOcclusionCuller: options.getGpuOcclusionCuller(),
        gpuVoxelCache: options.getGpuVoxelCache(),
      })
      isDirty = true
    },
  }
}
