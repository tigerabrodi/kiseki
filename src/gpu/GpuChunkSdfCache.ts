import { GpuChunkBufferCache } from './GpuChunkBufferCache.ts'
import type { GpuSdfBufferHandle } from './GpuSdfSlab.ts'

export class GpuChunkSdfCache extends GpuChunkBufferCache<GpuSdfBufferHandle> {}
