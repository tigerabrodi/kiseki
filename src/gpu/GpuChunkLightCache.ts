import { GpuChunkBufferCache } from './GpuChunkBufferCache.ts'
import type { GpuLightBufferHandle } from './GpuLightSlab.ts'

export class GpuChunkLightCache extends GpuChunkBufferCache<GpuLightBufferHandle> {}
