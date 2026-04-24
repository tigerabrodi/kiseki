import { chunkKey, type ChunkCoordinates } from '../world/World.ts'
import { CHUNK_VOLUME } from '../voxel/chunk.ts'
import type { GpuVoxelBufferHandle } from './GpuChunkVoxelCache.ts'
import { FixedSlotAllocator } from './FixedSlotAllocator.ts'
import { getGpuBufferUsage } from './webGpuStatics.ts'
import { GPU_VOXEL_BUFFER_BYTE_LENGTH } from './voxelStorageCodec.ts'

const ZERO_VOXEL_WORDS = new Uint32Array(
  GPU_VOXEL_BUFFER_BYTE_LENGTH / Uint32Array.BYTES_PER_ELEMENT
)

export class GpuVoxelSlab {
  private readonly allocator: FixedSlotAllocator
  private readonly buffer: GPUBuffer
  private readonly capacityValue: number
  private readonly device: GPUDevice

  constructor(device: GPUDevice, capacity: number) {
    this.device = device
    this.capacityValue = capacity
    this.allocator = new FixedSlotAllocator(capacity)
    const gpuBufferUsage = getGpuBufferUsage()

    this.buffer = device.createBuffer({
      label: 'voxel_slab',
      size: capacity * GPU_VOXEL_BUFFER_BYTE_LENGTH,
      usage:
        gpuBufferUsage.STORAGE |
        gpuBufferUsage.COPY_DST |
        gpuBufferUsage.COPY_SRC,
    })
  }

  activeByteLength(): number {
    return this.allocator.allocatedCount() * GPU_VOXEL_BUFFER_BYTE_LENGTH
  }

  activeCount(): number {
    return this.allocator.allocatedCount()
  }

  allocate(coords: ChunkCoordinates): GpuVoxelBufferHandle {
    const slotIndex = this.allocator.allocate()
    const byteOffset = slotIndex * GPU_VOXEL_BUFFER_BYTE_LENGTH

    this.device.queue.writeBuffer(this.buffer, byteOffset, ZERO_VOXEL_WORDS)

    return {
      buffer: this.buffer,
      byteOffset,
      byteLength: GPU_VOXEL_BUFFER_BYTE_LENGTH,
      isSlabAllocated: true,
      label: `chunk_voxels_${chunkKey(coords)}`,
      slotIndex,
      voxelCount: CHUNK_VOLUME,
    }
  }

  capacity(): number {
    return this.capacityValue
  }

  dispose(): void {
    this.buffer.destroy()
  }

  release(handle: GpuVoxelBufferHandle): void {
    if (handle.isSlabAllocated !== true) {
      throw new Error(
        `Cannot release non-slab GPU voxel buffer ${handle.label} from GpuVoxelSlab`
      )
    }

    this.allocator.free(handle.slotIndex)
  }

  reservedByteLength(): number {
    return this.capacityValue * GPU_VOXEL_BUFFER_BYTE_LENGTH
  }
}
