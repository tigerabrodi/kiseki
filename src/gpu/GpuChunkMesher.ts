import * as THREE from 'three/webgpu'

import type { ChunkFaceDirection } from '../mesh/buildChunkQuads.ts'
import type { ChunkCoordinates } from '../world/World.ts'
import { chunkKey } from '../world/World.ts'
import { CHUNK_VOLUME } from '../voxel/chunk.ts'
import { readGpuBufferToUint32Array } from './GpuVoxelBuffer.ts'
import type { GpuVoxelBufferHandle } from './GpuChunkVoxelCache.ts'
import {
  createGpuChunkMeshingShader,
  GPU_CHUNK_MESH_COUNTER_BYTE_LENGTH,
  GPU_CHUNK_MESH_INDEX_BYTE_LENGTH,
  GPU_CHUNK_MESH_MAX_FACE_COUNT,
  GPU_CHUNK_MESH_MAX_INDEX_COUNT,
  GPU_CHUNK_MESH_MAX_VERTEX_COUNT,
  GPU_CHUNK_MESH_VERTEX_BYTE_LENGTH,
} from './gpuChunkMeshingShader.ts'
import { GPU_VOXEL_BUFFER_BYTE_LENGTH } from './voxelStorageCodec.ts'
import { getGpuBufferUsage } from './webGpuStatics.ts'

const FACE_DIRECTIONS = [
  'px',
  'nx',
  'py',
  'ny',
  'pz',
  'nz',
] as const satisfies ReadonlyArray<ChunkFaceDirection>
const MESHER_PARAM_WORD_COUNT = 4
const INDEX_COUNT_BYTE_OFFSET = Uint32Array.BYTES_PER_ELEMENT * 2

export const GPU_CHUNK_MESH_INDIRECT_WORD_COUNT = 5
export const GPU_CHUNK_MESH_INDIRECT_BYTE_LENGTH =
  GPU_CHUNK_MESH_INDIRECT_WORD_COUNT * Uint32Array.BYTES_PER_ELEMENT
export function createGpuChunkIndirectDrawArgs(
  indexCount: number,
  firstIndex: number,
  baseVertex: number
): Uint32Array {
  return new Uint32Array([
    indexCount >>> 0,
    1,
    firstIndex >>> 0,
    baseVertex >>> 0,
    0,
  ])
}

export function createGpuChunkIndirectDrawTemplate(
  firstIndex: number,
  baseVertex: number
): Uint32Array {
  return createGpuChunkIndirectDrawArgs(0, firstIndex, baseVertex)
}

export const GPU_CHUNK_MESH_INDIRECT_DRAW_TEMPLATE =
  createGpuChunkIndirectDrawTemplate(0, 0)

export type GpuVoxelBufferNeighbors = Partial<
  Record<ChunkFaceDirection, GpuVoxelBufferHandle>
>

export type GpuChunkMeshHandle = {
  baseVertex: number
  countsByteOffset: number
  countsBuffer: GPUBuffer
  countsByteLength: number
  firstIndex: number
  indirectBuffer: GPUBuffer
  indirectByteLength: number
  indirectByteOffset: number
  indexBuffer: GPUBuffer
  indexByteLength: number
  indexByteOffset: number
  isSlabAllocated: boolean
  label: string
  maxFaceCount: number
  maxIndexCount: number
  maxVertexCount: number
  renderBuffers?: {
    indirectAttribute: THREE.IndirectStorageBufferAttribute
    indexAttribute: THREE.StorageBufferAttribute
    packedDataAttribute: THREE.StorageBufferAttribute
  }
  slotIndex: number
  stagingIndexBuffer?: GPUBuffer
  stagingIndexByteLength?: number
  stagingIndexByteOffset?: number
  stagingVertexBuffer?: GPUBuffer
  stagingVertexByteLength?: number
  stagingVertexByteOffset?: number
  vertexBuffer: GPUBuffer
  vertexByteLength: number
  vertexByteOffset: number
}

export type GpuChunkMeshCounts = {
  faceCount: number
  indexCount: number
  vertexCount: number
  visibleFaceCount: number
}

export type GpuChunkMeshReadback = GpuChunkMeshCounts & {
  indices: Uint32Array
  packedVertices: Uint32Array
}

export type GpuChunkMeshJob = {
  currentVoxelBuffer: GpuVoxelBufferHandle
  handle: GpuChunkMeshHandle
  neighbors: GpuVoxelBufferNeighbors
}

const ZERO_MESH_COUNTERS = new Uint32Array(4)

function createMesherParamBufferData(faceDirectionIndex: number): Uint32Array {
  return new Uint32Array([faceDirectionIndex >>> 0, 0, 0, 0])
}

function createZeroVoxelBuffer(device: GPUDevice): GPUBuffer {
  const gpuBufferUsage = getGpuBufferUsage()
  const byteLength = CHUNK_VOLUME * Uint32Array.BYTES_PER_ELEMENT
  const buffer = device.createBuffer({
    label: 'chunk_voxels_zero',
    mappedAtCreation: true,
    size: byteLength,
    usage: gpuBufferUsage.STORAGE | gpuBufferUsage.COPY_DST,
  })

  new Uint32Array(buffer.getMappedRange()).fill(0)
  buffer.unmap()

  return buffer
}

function getTotalMeshBytes(handle: GpuChunkMeshHandle): number {
  return (
    handle.countsByteLength +
    handle.indirectByteLength +
    handle.indexByteLength +
    handle.vertexByteLength
  )
}

export function createGpuChunkMeshHandle(
  device: GPUDevice,
  coords: ChunkCoordinates
): GpuChunkMeshHandle {
  const gpuBufferUsage = getGpuBufferUsage()
  const label = `chunk_mesh_${chunkKey(coords)}`
  const indirectBuffer = device.createBuffer({
    label: `${label}_indirect`,
    mappedAtCreation: true,
    size: GPU_CHUNK_MESH_INDIRECT_BYTE_LENGTH,
    usage:
      gpuBufferUsage.INDIRECT |
      gpuBufferUsage.STORAGE |
      gpuBufferUsage.COPY_DST |
      gpuBufferUsage.COPY_SRC,
  })

  new Uint32Array(indirectBuffer.getMappedRange()).set(
    GPU_CHUNK_MESH_INDIRECT_DRAW_TEMPLATE
  )
  indirectBuffer.unmap()

  return {
    baseVertex: 0,
    countsByteOffset: 0,
    countsBuffer: device.createBuffer({
      label: `${label}_counts`,
      size: GPU_CHUNK_MESH_COUNTER_BYTE_LENGTH,
      usage:
        gpuBufferUsage.STORAGE |
        gpuBufferUsage.COPY_DST |
        gpuBufferUsage.COPY_SRC,
    }),
    countsByteLength: GPU_CHUNK_MESH_COUNTER_BYTE_LENGTH,
    firstIndex: 0,
    indirectBuffer,
    indirectByteLength: GPU_CHUNK_MESH_INDIRECT_BYTE_LENGTH,
    indirectByteOffset: 0,
    indexBuffer: device.createBuffer({
      label: `${label}_indices`,
      size: GPU_CHUNK_MESH_INDEX_BYTE_LENGTH,
      usage:
        gpuBufferUsage.STORAGE | gpuBufferUsage.COPY_SRC | gpuBufferUsage.INDEX,
    }),
    indexByteLength: GPU_CHUNK_MESH_INDEX_BYTE_LENGTH,
    indexByteOffset: 0,
    isSlabAllocated: false,
    label,
    maxFaceCount: GPU_CHUNK_MESH_MAX_FACE_COUNT,
    maxIndexCount: GPU_CHUNK_MESH_MAX_INDEX_COUNT,
    maxVertexCount: GPU_CHUNK_MESH_MAX_VERTEX_COUNT,
    slotIndex: 0,
    vertexBuffer: device.createBuffer({
      label: `${label}_vertices`,
      size: GPU_CHUNK_MESH_VERTEX_BYTE_LENGTH,
      usage:
        gpuBufferUsage.STORAGE |
        gpuBufferUsage.COPY_SRC |
        gpuBufferUsage.VERTEX,
    }),
    vertexByteLength: GPU_CHUNK_MESH_VERTEX_BYTE_LENGTH,
    vertexByteOffset: 0,
  }
}

export function destroyGpuChunkMeshHandle(handle: GpuChunkMeshHandle): void {
  handle.countsBuffer.destroy()
  if (handle.renderBuffers === undefined) {
    handle.indirectBuffer.destroy()
    handle.indexBuffer.destroy()
    handle.vertexBuffer.destroy()
  }
}

export async function readGpuChunkMeshCounts(
  device: GPUDevice,
  handle: GpuChunkMeshHandle
): Promise<GpuChunkMeshCounts> {
  const counts = await readGpuBufferToUint32Array(
    device,
    handle.countsBuffer,
    handle.countsByteLength,
    `${handle.label}_counts`,
    handle.countsByteOffset
  )

  return {
    faceCount: counts[0] ?? 0,
    indexCount: counts[2] ?? 0,
    vertexCount: counts[1] ?? 0,
    visibleFaceCount: counts[3] ?? 0,
  }
}

export async function readGpuChunkMesh(
  device: GPUDevice,
  handle: GpuChunkMeshHandle
): Promise<GpuChunkMeshReadback> {
  const counts = await readGpuChunkMeshCounts(device, handle)
  const [packedVertices, indices] = await Promise.all([
    readGpuBufferToUint32Array(
      device,
      handle.vertexBuffer,
      counts.vertexCount * Uint32Array.BYTES_PER_ELEMENT,
      `${handle.label}_vertices`,
      handle.vertexByteOffset
    ),
    readGpuBufferToUint32Array(
      device,
      handle.indexBuffer,
      counts.indexCount * Uint32Array.BYTES_PER_ELEMENT,
      `${handle.label}_indices`,
      handle.indexByteOffset
    ),
  ])

  return {
    ...counts,
    indices,
    packedVertices,
  }
}

export function getGpuChunkMeshInfo(
  coords: ChunkCoordinates,
  handle: GpuChunkMeshHandle | undefined
): {
  baseVertex: number
  countByteOffset: number
  coords: ChunkCoordinates
  countByteLength: number
  firstIndex: number
  indirectByteLength: number
  indirectByteOffset: number
  indexByteLength: number
  indexByteOffset: number
  isSlabAllocated: boolean
  label: string
  maxFaceCount: number
  maxIndexCount: number
  maxVertexCount: number
  slotIndex: number
  stagingIndexByteLength: number | null
  stagingIndexByteOffset: number | null
  stagingVertexByteLength: number | null
  stagingVertexByteOffset: number | null
  totalByteLength: number
  vertexByteLength: number
  vertexByteOffset: number
} | null {
  if (handle === undefined) {
    return null
  }

  return {
    baseVertex: handle.baseVertex,
    countByteOffset: handle.countsByteOffset,
    coords: { ...coords },
    countByteLength: handle.countsByteLength,
    firstIndex: handle.firstIndex,
    indirectByteLength: handle.indirectByteLength,
    indirectByteOffset: handle.indirectByteOffset,
    indexByteLength: handle.indexByteLength,
    indexByteOffset: handle.indexByteOffset,
    isSlabAllocated: handle.isSlabAllocated,
    label: handle.label,
    maxFaceCount: handle.maxFaceCount,
    maxIndexCount: handle.maxIndexCount,
    maxVertexCount: handle.maxVertexCount,
    slotIndex: handle.slotIndex,
    stagingIndexByteLength: handle.stagingIndexByteLength ?? null,
    stagingIndexByteOffset: handle.stagingIndexByteOffset ?? null,
    stagingVertexByteLength: handle.stagingVertexByteLength ?? null,
    stagingVertexByteOffset: handle.stagingVertexByteOffset ?? null,
    totalByteLength: getTotalMeshBytes(handle),
    vertexByteLength: handle.vertexByteLength,
    vertexByteOffset: handle.vertexByteOffset,
  }
}

function getMeshVertexWriteTarget(handle: GpuChunkMeshHandle): {
  buffer: GPUBuffer
  byteLength: number
  byteOffset: number
} {
  return {
    buffer: handle.stagingVertexBuffer ?? handle.vertexBuffer,
    byteLength: handle.stagingVertexByteLength ?? handle.vertexByteLength,
    byteOffset: handle.stagingVertexByteOffset ?? handle.vertexByteOffset,
  }
}

function getMeshIndexWriteTarget(handle: GpuChunkMeshHandle): {
  buffer: GPUBuffer
  byteLength: number
  byteOffset: number
} {
  return {
    buffer: handle.stagingIndexBuffer ?? handle.indexBuffer,
    byteLength: handle.stagingIndexByteLength ?? handle.indexByteLength,
    byteOffset: handle.stagingIndexByteOffset ?? handle.indexByteOffset,
  }
}

export class GpuChunkMesher {
  private readonly bindGroupLayout: GPUBindGroupLayout
  private readonly device: GPUDevice
  private readonly faceParamBuffers: Array<GPUBuffer>
  private readonly pipeline: GPUComputePipeline
  private readonly zeroVoxelBuffer: GPUBuffer

  constructor(device: GPUDevice) {
    this.device = device
    const gpuBufferUsage = getGpuBufferUsage()
    this.zeroVoxelBuffer = createZeroVoxelBuffer(device)
    const shaderModule = device.createShaderModule({
      code: createGpuChunkMeshingShader(),
      label: 'chunk_mesher_shader',
    })

    this.pipeline = device.createComputePipeline({
      compute: {
        entryPoint: 'main',
        module: shaderModule,
      },
      label: 'chunk_mesher_pipeline',
      layout: 'auto',
    })
    this.bindGroupLayout = this.pipeline.getBindGroupLayout(0)
    this.faceParamBuffers = FACE_DIRECTIONS.map(
      (_faceDirection, faceDirectionIndex) => {
        const paramBuffer = device.createBuffer({
          label: `chunk_mesher_face_${faceDirectionIndex}_params`,
          mappedAtCreation: true,
          size: MESHER_PARAM_WORD_COUNT * Uint32Array.BYTES_PER_ELEMENT,
          usage: gpuBufferUsage.UNIFORM | gpuBufferUsage.COPY_DST,
        })

        new Uint32Array(paramBuffer.getMappedRange()).set(
          createMesherParamBufferData(faceDirectionIndex)
        )
        paramBuffer.unmap()

        return paramBuffer
      }
    )
  }

  createMeshHandle(coords: ChunkCoordinates): GpuChunkMeshHandle {
    return createGpuChunkMeshHandle(this.device, coords)
  }

  destroy(): void {
    for (const paramBuffer of this.faceParamBuffers) {
      paramBuffer.destroy()
    }

    this.zeroVoxelBuffer.destroy()
  }

  private encodeMeshChunk(encoder: GPUCommandEncoder, job: GpuChunkMeshJob) {
    const { currentVoxelBuffer, handle, neighbors } = job
    const vertexWriteTarget = getMeshVertexWriteTarget(handle)
    const indexWriteTarget = getMeshIndexWriteTarget(handle)

    for (const [
      faceDirectionIndex,
      faceDirection,
    ] of FACE_DIRECTIONS.entries()) {
      const bindGroup = this.device.createBindGroup({
        entries: [
          {
            binding: 0,
            resource: {
              buffer: currentVoxelBuffer.buffer,
              offset: currentVoxelBuffer.byteOffset,
              size: currentVoxelBuffer.byteLength,
            },
          },
          {
            binding: 1,
            resource: {
              buffer: neighbors[faceDirection]?.buffer ?? this.zeroVoxelBuffer,
              offset: neighbors[faceDirection]?.byteOffset ?? 0,
              size:
                neighbors[faceDirection]?.byteLength ??
                GPU_VOXEL_BUFFER_BYTE_LENGTH,
            },
          },
          {
            binding: 2,
            resource: {
              buffer: vertexWriteTarget.buffer,
              offset: vertexWriteTarget.byteOffset,
              size: vertexWriteTarget.byteLength,
            },
          },
          {
            binding: 3,
            resource: {
              buffer: indexWriteTarget.buffer,
              offset: indexWriteTarget.byteOffset,
              size: indexWriteTarget.byteLength,
            },
          },
          {
            binding: 4,
            resource: {
              buffer: handle.countsBuffer,
              offset: handle.countsByteOffset,
              size: handle.countsByteLength,
            },
          },
          {
            binding: 5,
            resource: {
              buffer: this.faceParamBuffers[faceDirectionIndex],
            },
          },
        ],
        label: `${handle.label}_${faceDirection}_bind_group`,
        layout: this.bindGroupLayout,
      })
      const pass = encoder.beginComputePass({
        label: `${handle.label}_${faceDirection}_pass`,
      })

      pass.setPipeline(this.pipeline)
      pass.setBindGroup(0, bindGroup)
      pass.dispatchWorkgroups(1)
      pass.end()
    }

    encoder.copyBufferToBuffer(
      handle.countsBuffer,
      handle.countsByteOffset + INDEX_COUNT_BYTE_OFFSET,
      handle.indirectBuffer,
      handle.indirectByteOffset,
      Uint32Array.BYTES_PER_ELEMENT
    )
  }

  meshChunk(
    handle: GpuChunkMeshHandle,
    currentVoxelBuffer: GpuVoxelBufferHandle,
    neighbors: GpuVoxelBufferNeighbors
  ): void {
    this.meshChunks([
      {
        currentVoxelBuffer,
        handle,
        neighbors,
      },
    ])
  }

  meshChunks(jobs: ReadonlyArray<GpuChunkMeshJob>): void {
    if (jobs.length === 0) {
      return
    }

    const encoder = this.device.createCommandEncoder({
      label:
        jobs.length === 1
          ? `${jobs[0]?.handle.label ?? 'chunk_mesh'}_encoder`
          : `chunk_mesher_batch_${jobs.length}_encoder`,
    })

    for (const job of jobs) {
      this.device.queue.writeBuffer(
        job.handle.countsBuffer,
        job.handle.countsByteOffset,
        ZERO_MESH_COUNTERS
      )
      this.device.queue.writeBuffer(
        job.handle.indirectBuffer,
        job.handle.indirectByteOffset,
        createGpuChunkIndirectDrawTemplate(
          job.handle.firstIndex,
          job.handle.baseVertex
        )
      )
      this.encodeMeshChunk(encoder, job)
    }

    this.device.queue.submit([encoder.finish()])
  }
}
