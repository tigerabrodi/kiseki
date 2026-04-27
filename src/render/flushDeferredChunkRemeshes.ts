import type { ChunkStreamUpdate } from '../world/ChunkStreamer.ts'
import type { ChunkCoordinates } from '../world/World.ts'
import type { DeferredChunkRemeshQueue } from './deferredChunkRemeshQueue.ts'
import type { SyncStreamedGpuChunkMeshesResult } from './syncStreamedGpuChunkMeshes.ts'

type SyncGpuChunkMeshes = (
  update: Pick<ChunkStreamUpdate, 'loaded' | 'unloaded'>,
  encoder?: GPUCommandEncoder,
  options?: {
    extraRemeshChunkCoords?: Array<ChunkCoordinates>
    includeNeighborRemeshes?: boolean
  }
) => SyncStreamedGpuChunkMeshesResult | null

type FlushDeferredChunkRemeshesOptions = {
  gpuDevice: GPUDevice | null
  maxRemeshCount: number
  onGpuSubmission: () => void
  queue: DeferredChunkRemeshQueue
  syncGpuChunkMeshes: SyncGpuChunkMeshes
}

export function flushDeferredChunkRemeshes(
  options: FlushDeferredChunkRemeshesOptions
): void {
  if (options.queue.size() === 0) {
    return
  }

  const deferredRemeshCoords = options.queue.take(options.maxRemeshCount)
  const deferredRemeshEncoder = options.gpuDevice?.createCommandEncoder({
    label: 'deferred_chunk_neighbor_remesh_encoder',
  })
  const deferredMeshSyncResult = options.syncGpuChunkMeshes(
    {
      loaded: [],
      unloaded: [],
    },
    deferredRemeshEncoder,
    {
      extraRemeshChunkCoords: deferredRemeshCoords,
      includeNeighborRemeshes: false,
    }
  )

  if (
    options.gpuDevice !== null &&
    deferredRemeshEncoder !== undefined &&
    (deferredMeshSyncResult?.gpuComputePassCount ?? 0) > 0
  ) {
    options.gpuDevice.queue.submit([deferredRemeshEncoder.finish()])
    options.onGpuSubmission()
  }
}
