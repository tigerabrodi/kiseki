import * as THREE from 'three/webgpu'
import type { WebGPURenderer } from 'three/webgpu'

import { CHUNK_VOLUME } from '../voxel/chunk.ts'
import { chunkKey, type ChunkCoordinates } from '../world/World.ts'
import {
  createRendererStorageAttribute,
  getWebGpuBackend,
} from './getWebGpuBackend.ts'
import { GPU_LIGHT_BUFFER_BYTE_LENGTH } from './lightStorageCodec.ts'
import { getGpuBufferUsage } from './webGpuStatics.ts'

const EMPTY_LIGHT_VALUES = new Uint32Array(CHUNK_VOLUME)

export type GpuLightBufferHandle = {
  buffer: GPUBuffer
  byteLength: number
  byteOffset: number
  isSlabAllocated: boolean
  label: string
  scratchBuffer: GPUBuffer
  scratchByteOffset: number
  slotIndex: number
  valueCount: number
}

export type GpuLightMaterialState = {
  lightAttribute: THREE.StorageBufferAttribute
  valueCount: number
}

export class GpuLightSlab {
  private readonly activeSlots = new Set<number>()
  private readonly buffer: GPUBuffer
  private readonly capacityValue: number
  private readonly device: GPUDevice
  private readonly lightAttribute: THREE.StorageBufferAttribute
  private readonly scratchBuffer: GPUBuffer

  constructor(renderer: WebGPURenderer, capacity: number) {
    const backend = getWebGpuBackend(renderer)
    const gpuBufferUsage = getGpuBufferUsage()

    this.capacityValue = capacity
    this.device = backend.device
    this.lightAttribute = new THREE.StorageBufferAttribute(
      new Uint32Array(capacity * CHUNK_VOLUME),
      1
    )
    this.lightAttribute.name = 'chunk_light_levels'
    this.buffer = createRendererStorageAttribute(backend, this.lightAttribute)
    this.scratchBuffer = this.device.createBuffer({
      label: 'chunk_light_scratch_levels',
      size: capacity * GPU_LIGHT_BUFFER_BYTE_LENGTH,
      usage:
        gpuBufferUsage.STORAGE |
        gpuBufferUsage.COPY_DST |
        gpuBufferUsage.COPY_SRC,
    })
  }

  activeCount(): number {
    return this.activeSlots.size
  }

  allocate(
    coords: ChunkCoordinates,
    preferredSlotIndex: number
  ): GpuLightBufferHandle {
    if (
      !Number.isInteger(preferredSlotIndex) ||
      preferredSlotIndex < 0 ||
      preferredSlotIndex >= this.capacityValue
    ) {
      throw new RangeError(`Invalid light slot index ${preferredSlotIndex}`)
    }

    const byteOffset = preferredSlotIndex * GPU_LIGHT_BUFFER_BYTE_LENGTH

    this.activeSlots.add(preferredSlotIndex)
    this.device.queue.writeBuffer(this.buffer, byteOffset, EMPTY_LIGHT_VALUES)
    this.device.queue.writeBuffer(
      this.scratchBuffer,
      byteOffset,
      EMPTY_LIGHT_VALUES
    )

    return {
      buffer: this.buffer,
      byteLength: GPU_LIGHT_BUFFER_BYTE_LENGTH,
      byteOffset,
      isSlabAllocated: true,
      label: `chunk_light_${chunkKey(coords)}`,
      scratchBuffer: this.scratchBuffer,
      scratchByteOffset: byteOffset,
      slotIndex: preferredSlotIndex,
      valueCount: CHUNK_VOLUME,
    }
  }

  capacity(): number {
    return this.capacityValue
  }

  dispose(): void {
    this.buffer.destroy()
    this.scratchBuffer.destroy()
  }

  getMaterialState(): GpuLightMaterialState {
    return {
      lightAttribute: this.lightAttribute,
      valueCount: this.capacityValue * CHUNK_VOLUME,
    }
  }

  release(handle: GpuLightBufferHandle): void {
    if (handle.isSlabAllocated !== true) {
      throw new Error(
        `Cannot release non-slab GPU light buffer ${handle.label} from GpuLightSlab`
      )
    }

    this.activeSlots.delete(handle.slotIndex)
    this.device.queue.writeBuffer(
      this.buffer,
      handle.byteOffset,
      EMPTY_LIGHT_VALUES
    )
    this.device.queue.writeBuffer(
      this.scratchBuffer,
      handle.scratchByteOffset,
      EMPTY_LIGHT_VALUES
    )
  }

  reservedByteLength(): number {
    return this.capacityValue * GPU_LIGHT_BUFFER_BYTE_LENGTH * 2
  }
}
