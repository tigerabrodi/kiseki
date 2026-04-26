import * as THREE from 'three/webgpu'
import type { WebGPURenderer } from 'three/webgpu'

import { CHUNK_VOLUME } from '../voxel/chunk.ts'
import { chunkKey, type ChunkCoordinates } from '../world/World.ts'
import type { GpuPoolRuntimeStats } from './buildGpuAllocationSnapshot.ts'
import {
  createRendererStorageAttribute,
  getWebGpuBackend,
} from './getWebGpuBackend.ts'
import {
  GPU_SDF_BUFFER_BYTE_LENGTH,
  GPU_SDF_DEFAULT_DISTANCE,
} from './sdfStorageCodec.ts'

const DEFAULT_SDF_VALUES = new Float32Array(CHUNK_VOLUME).fill(
  GPU_SDF_DEFAULT_DISTANCE
)

export type GpuSdfBufferHandle = {
  buffer: GPUBuffer
  byteOffset: number
  byteLength: number
  isSlabAllocated: boolean
  label: string
  slotIndex: number
  valueCount: number
}

export type GpuSdfMaterialState = {
  sdfAttribute: THREE.StorageBufferAttribute
  valueCount: number
}

export class GpuSdfSlab {
  private readonly activeSlots = new Set<number>()
  private allocationCount = 0
  private readonly buffer: GPUBuffer
  private readonly capacityValue: number
  private readonly device: GPUDevice
  private highWaterCount = 0
  private releaseCount = 0
  private readonly sdfAttribute: THREE.StorageBufferAttribute

  constructor(renderer: WebGPURenderer, capacity: number) {
    const backend = getWebGpuBackend(renderer)

    this.capacityValue = capacity
    this.device = backend.device
    this.sdfAttribute = new THREE.StorageBufferAttribute(
      new Float32Array(capacity * CHUNK_VOLUME),
      1
    )
    this.sdfAttribute.name = 'chunk_sdf_values'
    this.buffer = createRendererStorageAttribute(backend, this.sdfAttribute)

    for (let slotIndex = 0; slotIndex < capacity; slotIndex += 1) {
      this.device.queue.writeBuffer(
        this.buffer,
        slotIndex * GPU_SDF_BUFFER_BYTE_LENGTH,
        DEFAULT_SDF_VALUES
      )
    }
  }

  activeCount(): number {
    return this.activeSlots.size
  }

  activeByteLength(): number {
    return this.activeCount() * GPU_SDF_BUFFER_BYTE_LENGTH
  }

  allocate(
    coords: ChunkCoordinates,
    preferredSlotIndex: number
  ): GpuSdfBufferHandle {
    if (
      !Number.isInteger(preferredSlotIndex) ||
      preferredSlotIndex < 0 ||
      preferredSlotIndex >= this.capacityValue
    ) {
      throw new RangeError(`Invalid SDF slot index ${preferredSlotIndex}`)
    }

    this.activeSlots.add(preferredSlotIndex)
    this.allocationCount += 1
    this.highWaterCount = Math.max(this.highWaterCount, this.activeCount())
    this.device.queue.writeBuffer(
      this.buffer,
      preferredSlotIndex * GPU_SDF_BUFFER_BYTE_LENGTH,
      DEFAULT_SDF_VALUES
    )

    return {
      buffer: this.buffer,
      byteOffset: preferredSlotIndex * GPU_SDF_BUFFER_BYTE_LENGTH,
      byteLength: GPU_SDF_BUFFER_BYTE_LENGTH,
      isSlabAllocated: true,
      label: `chunk_sdf_${chunkKey(coords)}`,
      slotIndex: preferredSlotIndex,
      valueCount: CHUNK_VOLUME,
    }
  }

  capacity(): number {
    return this.capacityValue
  }

  dispose(): void {
    this.buffer.destroy()
  }

  getMaterialState(): GpuSdfMaterialState {
    return {
      sdfAttribute: this.sdfAttribute,
      valueCount: this.capacityValue * CHUNK_VOLUME,
    }
  }

  getRuntimeStats(): GpuPoolRuntimeStats {
    return {
      activeByteLength: this.activeByteLength(),
      activeCount: this.activeCount(),
      allocationCount: this.allocationCount,
      availableCount: this.capacityValue - this.activeCount(),
      bufferCount: 1,
      capacity: this.capacity(),
      highWaterCount: this.highWaterCount,
      releaseCount: this.releaseCount,
      reservedByteLength: this.reservedByteLength(),
    }
  }

  release(handle: GpuSdfBufferHandle): void {
    if (handle.isSlabAllocated !== true) {
      throw new Error(
        `Cannot release non-slab GPU SDF buffer ${handle.label} from GpuSdfSlab`
      )
    }

    this.activeSlots.delete(handle.slotIndex)
    this.releaseCount += 1
    this.device.queue.writeBuffer(
      this.buffer,
      handle.byteOffset,
      DEFAULT_SDF_VALUES
    )
  }

  reservedByteLength(): number {
    return this.capacityValue * GPU_SDF_BUFFER_BYTE_LENGTH
  }
}
