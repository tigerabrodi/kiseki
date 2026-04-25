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
  createGpuChunkIndirectDrawArgs,
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
import type { GpuPoolRuntimeStats } from './buildGpuAllocationSnapshot.ts'
import { planGpuMeshCompaction } from './planGpuMeshCompaction.ts'
import { readGpuBufferToUint32Array } from './GpuVoxelBuffer.ts'
import { getGpuBufferUsage } from './webGpuStatics.ts'

const ZERO_MESH_COUNTERS = new Uint32Array(4)

function alignTo(byteLength: number, alignment: number): number {
  const remainder = byteLength % alignment

  if (remainder === 0) {
    return byteLength
  }

  return byteLength + (alignment - remainder)
}

export type GpuMeshCompactionInfo = {
  activeChunkCount: number
  activeIndexByteLength: number
  activeVertexByteLength: number
  compactionCount: number
  emptyChunkCount: number
  lastCompactionDurationMs: number
  reservedIndexByteLength: number
  reservedMeshByteLength: number
  reservedVertexByteLength: number
  stagingIndexByteLength: number
  stagingVertexByteLength: number
}

function createEmptyCompactionInfo(
  reservedVertexByteLength: number,
  reservedIndexByteLength: number,
  stagingVertexByteLength: number,
  stagingIndexByteLength: number,
  reservedMeshByteLength: number
): GpuMeshCompactionInfo {
  return {
    activeChunkCount: 0,
    activeIndexByteLength: 0,
    activeVertexByteLength: 0,
    compactionCount: 0,
    emptyChunkCount: 0,
    lastCompactionDurationMs: 0,
    reservedIndexByteLength,
    reservedMeshByteLength,
    reservedVertexByteLength,
    stagingIndexByteLength,
    stagingVertexByteLength,
  }
}

export class GpuChunkMeshSlab {
  private allocationCount = 0
  private readonly allocator: FixedSlotAllocator
  private readonly capacityValue: number
  private readonly countsSlotByteLength: number
  private readonly countsBuffer: GPUBuffer
  private readonly device: GPUDevice
  private readonly indirectAttribute: THREE.IndirectStorageBufferAttribute
  private readonly indirectBuffer: GPUBuffer
  private readonly indexAttribute: THREE.StorageBufferAttribute
  private readonly renderIndexBuffer: GPUBuffer
  private readonly renderIndexByteLength: number
  private readonly packedDataAttribute: THREE.StorageBufferAttribute
  private readonly renderVertexBuffer: GPUBuffer
  private readonly renderVertexByteLength: number
  private readonly stagingIndexBuffer: GPUBuffer
  private readonly stagingIndexByteLength: number
  private readonly stagingVertexBuffer: GPUBuffer
  private readonly stagingVertexByteLength: number
  private highWaterCount = 0
  private lastCompactionInfo: GpuMeshCompactionInfo
  private releaseCount = 0

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
    this.renderVertexByteLength = capacity * GPU_CHUNK_MESH_VERTEX_BYTE_LENGTH
    this.renderIndexByteLength = capacity * GPU_CHUNK_MESH_INDEX_BYTE_LENGTH
    this.stagingVertexByteLength = capacity * GPU_CHUNK_MESH_VERTEX_BYTE_LENGTH
    this.stagingIndexByteLength = capacity * GPU_CHUNK_MESH_INDEX_BYTE_LENGTH

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
    this.packedDataAttribute.name = 'chunk_mesh_render_packed_data'
    this.indexAttribute.name = 'chunk_mesh_render_indices'
    this.indirectAttribute.name = 'chunk_mesh_render_indirect'

    for (let slotIndex = 0; slotIndex < capacity; slotIndex += 1) {
      this.indirectAttribute.array.set(
        createGpuChunkIndirectDrawTemplate(0, 0),
        slotIndex * GPU_CHUNK_MESH_INDIRECT_WORD_COUNT
      )
    }

    this.renderVertexBuffer = createRendererStorageAttribute(
      backend,
      this.packedDataAttribute
    )
    this.renderIndexBuffer = createRendererIndexAttribute(
      backend,
      this.indexAttribute
    )
    this.indirectBuffer = createRendererIndirectAttribute(
      backend,
      this.indirectAttribute
    )
    this.countsBuffer = this.device.createBuffer({
      label: 'chunk_mesh_counts_slab',
      size: capacity * this.countsSlotByteLength,
      usage:
        gpuBufferUsage.STORAGE |
        gpuBufferUsage.COPY_DST |
        gpuBufferUsage.COPY_SRC,
    })
    this.stagingVertexBuffer = this.device.createBuffer({
      label: 'chunk_mesh_staging_vertices',
      size: this.stagingVertexByteLength,
      usage:
        gpuBufferUsage.STORAGE |
        gpuBufferUsage.COPY_SRC |
        gpuBufferUsage.COPY_DST,
    })
    this.stagingIndexBuffer = this.device.createBuffer({
      label: 'chunk_mesh_staging_indices',
      size: this.stagingIndexByteLength,
      usage:
        gpuBufferUsage.STORAGE |
        gpuBufferUsage.COPY_SRC |
        gpuBufferUsage.COPY_DST,
    })
    this.lastCompactionInfo = createEmptyCompactionInfo(
      this.renderVertexByteLength,
      this.renderIndexByteLength,
      this.stagingVertexByteLength,
      this.stagingIndexByteLength,
      this.reservedByteLength()
    )
  }

  activeByteLength(): number {
    return (
      this.lastCompactionInfo.activeVertexByteLength +
      this.lastCompactionInfo.activeIndexByteLength +
      this.activeCount() *
        (this.countsSlotByteLength + GPU_CHUNK_MESH_INDIRECT_BYTE_LENGTH)
    )
  }

  activeCount(): number {
    return this.allocator.allocatedCount()
  }

  allocate(coords: ChunkCoordinates): GpuChunkMeshHandle {
    const slotIndex = this.allocator.allocate()
    const countsByteOffset = slotIndex * this.countsSlotByteLength
    const indirectByteOffset = slotIndex * GPU_CHUNK_MESH_INDIRECT_BYTE_LENGTH
    const stagingVertexByteOffset =
      slotIndex * GPU_CHUNK_MESH_VERTEX_BYTE_LENGTH
    const stagingIndexByteOffset = slotIndex * GPU_CHUNK_MESH_INDEX_BYTE_LENGTH

    this.allocationCount += 1
    this.highWaterCount = Math.max(this.highWaterCount, this.activeCount())

    this.device.queue.writeBuffer(
      this.countsBuffer,
      countsByteOffset,
      ZERO_MESH_COUNTERS
    )
    this.device.queue.writeBuffer(
      this.indirectBuffer,
      indirectByteOffset,
      createGpuChunkIndirectDrawTemplate(0, 0)
    )

    return {
      baseVertex: 0,
      countsBuffer: this.countsBuffer,
      countsByteLength: GPU_CHUNK_MESH_COUNTER_BYTE_LENGTH,
      countsByteOffset,
      firstIndex: 0,
      indirectBuffer: this.indirectBuffer,
      indirectByteLength: GPU_CHUNK_MESH_INDIRECT_BYTE_LENGTH,
      indirectByteOffset,
      indexBuffer: this.renderIndexBuffer,
      indexByteLength: 0,
      indexByteOffset: 0,
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
      stagingIndexBuffer: this.stagingIndexBuffer,
      stagingIndexByteLength: GPU_CHUNK_MESH_INDEX_BYTE_LENGTH,
      stagingIndexByteOffset,
      stagingVertexBuffer: this.stagingVertexBuffer,
      stagingVertexByteLength: GPU_CHUNK_MESH_VERTEX_BYTE_LENGTH,
      stagingVertexByteOffset,
      vertexBuffer: this.renderVertexBuffer,
      vertexByteLength: 0,
      vertexByteOffset: 0,
    }
  }

  async compact(
    handles: Array<GpuChunkMeshHandle>
  ): Promise<GpuMeshCompactionInfo> {
    const compactStartMs = performance.now()
    const countsWordStride =
      this.countsSlotByteLength / Uint32Array.BYTES_PER_ELEMENT
    const counts = await readGpuBufferToUint32Array(
      this.device,
      this.countsBuffer,
      this.capacityValue * this.countsSlotByteLength,
      'chunk_mesh_counts_slab'
    )
    const plan = planGpuMeshCompaction(
      handles.map((handle) => {
        const countsOffsetWords = handle.slotIndex * countsWordStride

        return {
          indexCount: counts[countsOffsetWords + 2] ?? 0,
          key: handle.label,
          sortOrder:
            handle.vertexByteLength > 0
              ? handle.vertexByteOffset
              : handle.slotIndex * GPU_CHUNK_MESH_VERTEX_BYTE_LENGTH,
          vertexCount: counts[countsOffsetWords + 1] ?? 0,
        }
      })
    )
    const assignmentMap = new Map(
      plan.assignments.map((assignment) => [assignment.key, assignment])
    )
    const encoder = this.device.createCommandEncoder({
      label: 'chunk_mesh_compaction_encoder',
    })
    let isCopyQueued = false

    for (const handle of handles) {
      const assignment = assignmentMap.get(handle.label)

      if (
        assignment !== undefined &&
        handle.stagingVertexByteOffset !== undefined &&
        handle.stagingIndexByteOffset !== undefined
      ) {
        if (assignment.vertexByteLength > 0) {
          encoder.copyBufferToBuffer(
            this.stagingVertexBuffer,
            handle.stagingVertexByteOffset,
            this.renderVertexBuffer,
            assignment.vertexByteOffset,
            assignment.vertexByteLength
          )
          isCopyQueued = true
        }

        if (assignment.indexByteLength > 0) {
          encoder.copyBufferToBuffer(
            this.stagingIndexBuffer,
            handle.stagingIndexByteOffset,
            this.renderIndexBuffer,
            assignment.indexByteOffset,
            assignment.indexByteLength
          )
          isCopyQueued = true
        }

        handle.baseVertex = assignment.baseVertex
        handle.firstIndex = assignment.firstIndex
        handle.vertexByteOffset = assignment.vertexByteOffset
        handle.vertexByteLength = assignment.vertexByteLength
        handle.indexByteOffset = assignment.indexByteOffset
        handle.indexByteLength = assignment.indexByteLength
        this.device.queue.writeBuffer(
          this.indirectBuffer,
          handle.indirectByteOffset,
          createGpuChunkIndirectDrawArgs(
            assignment.indexCount,
            assignment.firstIndex,
            assignment.baseVertex
          )
        )
        continue
      }

      handle.baseVertex = 0
      handle.firstIndex = 0
      handle.vertexByteOffset = 0
      handle.vertexByteLength = 0
      handle.indexByteOffset = 0
      handle.indexByteLength = 0
      this.device.queue.writeBuffer(
        this.indirectBuffer,
        handle.indirectByteOffset,
        createGpuChunkIndirectDrawTemplate(0, 0)
      )
    }

    if (isCopyQueued) {
      this.device.queue.submit([encoder.finish()])
    }

    this.lastCompactionInfo = {
      activeChunkCount: plan.activeChunkCount,
      activeIndexByteLength: plan.activeIndexByteLength,
      activeVertexByteLength: plan.activeVertexByteLength,
      compactionCount: this.lastCompactionInfo.compactionCount + 1,
      emptyChunkCount: plan.emptyChunkCount,
      lastCompactionDurationMs: performance.now() - compactStartMs,
      reservedIndexByteLength: this.renderIndexByteLength,
      reservedMeshByteLength: this.reservedByteLength(),
      reservedVertexByteLength: this.renderVertexByteLength,
      stagingIndexByteLength: this.stagingIndexByteLength,
      stagingVertexByteLength: this.stagingVertexByteLength,
    }

    return this.lastCompactionInfo
  }

  capacity(): number {
    return this.capacityValue
  }

  dispose(): void {
    this.countsBuffer.destroy()
    this.stagingIndexBuffer.destroy()
    this.stagingVertexBuffer.destroy()
  }

  getCompactionInfo(): GpuMeshCompactionInfo {
    return this.lastCompactionInfo
  }

  getRuntimeStats(): GpuPoolRuntimeStats {
    return {
      activeByteLength: this.activeByteLength(),
      activeCount: this.activeCount(),
      allocationCount: this.allocationCount,
      availableCount: this.allocator.availableCount(),
      bufferCount: 6,
      capacity: this.capacity(),
      highWaterCount: this.highWaterCount,
      releaseCount: this.releaseCount,
      reservedByteLength: this.reservedByteLength(),
    }
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
      ZERO_MESH_COUNTERS
    )
    this.device.queue.writeBuffer(
      this.indirectBuffer,
      handle.indirectByteOffset,
      createGpuChunkIndirectDrawTemplate(0, 0)
    )
    handle.baseVertex = 0
    handle.firstIndex = 0
    handle.vertexByteOffset = 0
    handle.vertexByteLength = 0
    handle.indexByteOffset = 0
    handle.indexByteLength = 0
    this.releaseCount += 1
    this.allocator.free(handle.slotIndex)
  }

  reservedByteLength(): number {
    return (
      this.capacityValue *
        (this.countsSlotByteLength + GPU_CHUNK_MESH_INDIRECT_BYTE_LENGTH) +
      this.renderVertexByteLength +
      this.renderIndexByteLength +
      this.stagingVertexByteLength +
      this.stagingIndexByteLength
    )
  }
}
