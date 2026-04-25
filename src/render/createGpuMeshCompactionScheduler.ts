import type { GpuChunkMeshCache } from '../gpu/GpuChunkMeshCache.ts'
import type { GpuChunkMeshSlab } from '../gpu/GpuChunkMeshSlab.ts'

type CreateGpuMeshCompactionSchedulerOptions = {
  getMeshCache: () => GpuChunkMeshCache | null
  getMeshSlab: () => GpuChunkMeshSlab | null
  onAfterCompaction: () => void
}

export type GpuMeshCompactionScheduler = {
  schedule: () => void
}

export function createGpuMeshCompactionScheduler(
  options: CreateGpuMeshCompactionSchedulerOptions
): GpuMeshCompactionScheduler {
  let isCompactionQueued = false
  let pendingCompaction: Promise<void> | null = null

  const schedule = (): void => {
    const meshSlab = options.getMeshSlab()
    const meshCache = options.getMeshCache()

    if (meshSlab === null || meshCache === null) {
      options.onAfterCompaction()
      return
    }

    if (pendingCompaction !== null) {
      isCompactionQueued = true
      return
    }

    pendingCompaction = meshSlab
      .compact(meshCache.handles())
      .then(() => undefined)
      .catch((error) => {
        console.error('Failed to compact GPU mesh slab', error)
      })
      .finally(() => {
        pendingCompaction = null
        options.onAfterCompaction()

        if (isCompactionQueued) {
          isCompactionQueued = false
          schedule()
        }
      })
  }

  return { schedule }
}
