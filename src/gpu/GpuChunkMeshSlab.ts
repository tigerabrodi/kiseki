import * as THREE from 'three/webgpu'
import type { WebGPURenderer } from 'three/webgpu'

import { chunkKey, type ChunkCoordinates } from '../world/World.ts'
import { FixedSlotAllocator } from './FixedSlotAllocator.ts'
import {
  createRendererIndexAttribute,
  createRendererIndirectAttribute,
  createRendererStorageAttribute,
  getWebGpuBackend,
} from './getWebGpuBackend.ts'
import {
  createGpuChunkIndirectDrawTemplate,
  type GpuChunkMeshHandle,
  GPU_CHUNK_MESH_INDIRECT_BYTE_LENGTH,
  GPU_CHUNK_MESH_INDIRECT_WORD_COUNT,
} from './GpuChunkMesher.ts'
import {
  GPU_CHUNK_MESH_COUNTER_BYTE_LENGTH,
  GPU_CHUNK_MESH_INDEX_BYTE_LENGTH,
  GPU_CHUNK_MESH_MAX_FACE_COUNT,
  GPU_CHUNK_MESH_MAX_INDEX_COUNT,
  GPU_CHUNK_MESH_MAX_VERTEX_COUNT,
  GPU_CHUNK_MESH_VERTEX_BYTE_LENGTH,
} from './gpuChunkMeshingShader.ts'
import { getGpuBufferUsage } from './webGpuStatics.ts'

const ZERO_MESH_COUNTS = new Uint32Array(4)

function alignTo(byteLength: number, alignment: number): number {
  const remainder = byteLength % alignment

  if (remainder === 0) {
    return byteLength
  }

  return byteLength + (alignment - remainder)
}

export class GpuChunkMeshSlab {
  private readonly allocator: FixedSlotAllocator
  private readonly capacityValue: number
  private readonly countsSlotByteLength: number
  private readonly countsBuffer: GPUBuffer
  private readonly device: GPUDevice
  private readonly indirectAttribute: THREE.IndirectStorageBufferAttribute
  private readonly indirectBuffer: GPUBuffer
  private readonly indexAttribute: THREE.StorageBufferAttribute
  private readonly indexBuffer: GPUBuffer
  private readonly packedDataAttribute: THREE.StorageBufferAttribute
  private readonly vertexBuffer: GPUBuffer

  constructor(renderer: WebGPURenderer, capacity: number) {
    const backend = getWebGpuBackend(renderer)
    const gpuBufferUsage = getGpuBufferUsage()

    this.device = backend.device
    this.capacityValue = capacity
    this.allocator = new FixedSlotAllocator(capacity)
    this.countsSlotByteLength = alignTo(
      GPU_CHUNK_MESH_COUNTER_BYTE_LENGTH,
      Math.max(backend.device.limits.minStorageBufferOffsetAlignment, 1)
    )

    this.packedDataAttribute = new THREE.StorageBufferAttribute(
      new Uint32Array(capacity * GPU_CHUNK_MESH_MAX_VERTEX_COUNT),
      1
    )
    this.indexAttribute = new THREE.StorageBufferAttribute(
      new Uint32Array(capacity * GPU_CHUNK_MESH_MAX_INDEX_COUNT),
      1
    )
    this.indirectAttribute = new THREE.IndirectStorageBufferAttribute(
      new Uint32Array(capacity * GPU_CHUNK_MESH_INDIRECT_WORD_COUNT),
      GPU_CHUNK_MESH_INDIRECT_WORD_COUNT
    )
    this.packedDataAttribute.name = 'chunk_mesh_slab_packed_data'
    this.indexAttribute.name = 'chunk_mesh_slab_indices'
    this.indirectAttribute.name = 'chunk_mesh_slab_indirect'

    for (let slotIndex = 0; slotIndex < capacity; slotIndex += 1) {
      this.indirectAttribute.array.set(
        createGpuChunkIndirectDrawTemplate(
          slotIndex * GPU_CHUNK_MESH_MAX_INDEX_COUNT,
          slotIndex * GPU_CHUNK_MESH_MAX_VERTEX_COUNT
        ),
        slotIndex * GPU_CHUNK_MESH_INDIRECT_WORD_COUNT
      )
    }

    this.vertexBuffer = createRendererStorageAttribute(
      backend,
      this.packedDataAttribute
    )
    this.indexBuffer = createRendererIndexAttribute(
      backend,
      this.indexAttribute
    )
    this.indirectBuffer = createRendererIndirectAttribute(
      backend,
      this.indirectAttribute
    )
    this.countsBuffer = this.device.createBuffer({
      label: 'chunk_mesh_slab_counts',
      size: capacity * this.countsSlotByteLength,
      usage:
        gpuBufferUsage.STORAGE |
        gpuBufferUsage.COPY_DST |
        gpuBufferUsage.COPY_SRC,
    })
  }

  activeByteLength(): number {
    return this.allocator.allocatedCount() * this.slotByteLength()
  }

  activeCount(): number {
    return this.allocator.allocatedCount()
  }

  allocate(coords: ChunkCoordinates): GpuChunkMeshHandle {
    const slotIndex = this.allocator.allocate()
    const vertexByteOffset = slotIndex * GPU_CHUNK_MESH_VERTEX_BYTE_LENGTH
    const indexByteOffset = slotIndex * GPU_CHUNK_MESH_INDEX_BYTE_LENGTH
    const countsByteOffset = slotIndex * this.countsSlotByteLength
    const indirectByteOffset = slotIndex * GPU_CHUNK_MESH_INDIRECT_BYTE_LENGTH
    const firstIndex = slotIndex * GPU_CHUNK_MESH_MAX_INDEX_COUNT
    const baseVertex = slotIndex * GPU_CHUNK_MESH_MAX_VERTEX_COUNT

    this.device.queue.writeBuffer(
      this.countsBuffer,
      countsByteOffset,
      ZERO_MESH_COUNTS
    )
    this.device.queue.writeBuffer(
      this.indirectBuffer,
      indirectByteOffset,
      createGpuChunkIndirectDrawTemplate(firstIndex, baseVertex)
    )

    return {
      baseVertex,
      countsBuffer: this.countsBuffer,
      countsByteLength: GPU_CHUNK_MESH_COUNTER_BYTE_LENGTH,
      countsByteOffset,
      firstIndex,
      indirectBuffer: this.indirectBuffer,
      indirectByteLength: GPU_CHUNK_MESH_INDIRECT_BYTE_LENGTH,
      indirectByteOffset,
      indexBuffer: this.indexBuffer,
      indexByteLength: GPU_CHUNK_MESH_INDEX_BYTE_LENGTH,
      indexByteOffset,
      isSlabAllocated: true,
      label: `chunk_mesh_${chunkKey(coords)}`,
      maxFaceCount: GPU_CHUNK_MESH_MAX_FACE_COUNT,
      maxIndexCount: GPU_CHUNK_MESH_MAX_INDEX_COUNT,
      maxVertexCount: GPU_CHUNK_MESH_MAX_VERTEX_COUNT,
      renderBuffers: {
        indirectAttribute: this.indirectAttribute,
        indexAttribute: this.indexAttribute,
        packedDataAttribute: this.packedDataAttribute,
      },
      slotIndex,
      vertexBuffer: this.vertexBuffer,
      vertexByteLength: GPU_CHUNK_MESH_VERTEX_BYTE_LENGTH,
      vertexByteOffset,
    }
  }

  capacity(): number {
    return this.capacityValue
  }

  dispose(): void {
    this.countsBuffer.destroy()
  }

  release(handle: GpuChunkMeshHandle): void {
    if (handle.isSlabAllocated !== true) {
      throw new Error(
        `Cannot release non-slab GPU mesh handle ${handle.label} from GpuChunkMeshSlab`
      )
    }

    this.device.queue.writeBuffer(
      this.countsBuffer,
      handle.countsByteOffset,
      ZERO_MESH_COUNTS
    )
    this.device.queue.writeBuffer(
      this.indirectBuffer,
      handle.indirectByteOffset,
      createGpuChunkIndirectDrawTemplate(handle.firstIndex, handle.baseVertex)
    )
    this.allocator.free(handle.slotIndex)
  }

  reservedByteLength(): number {
    return this.capacityValue * this.slotByteLength()
  }

  private slotByteLength(): number {
    return (
      this.countsSlotByteLength +
      GPU_CHUNK_MESH_INDIRECT_BYTE_LENGTH +
      GPU_CHUNK_MESH_INDEX_BYTE_LENGTH +
      GPU_CHUNK_MESH_VERTEX_BYTE_LENGTH
    )
  }
}
