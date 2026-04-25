import * as THREE from 'three/webgpu'
import type { WebGPURenderer } from 'three/webgpu'

import type { GpuChunkMeshHandle } from './GpuChunkMesher.ts'
import { readGpuBufferToUint32Array } from './GpuVoxelBuffer.ts'
import {
  countVisibleChunkSlots,
  extractCameraFrustumPlanes,
} from './frustumCulling.ts'
import {
  createRendererStorageAttribute,
  getWebGpuBackend,
} from './getWebGpuBackend.ts'
import {
  createGpuChunkVisibilityCullingShader,
  GPU_CHUNK_VISIBILITY_CULL_WORKGROUP_SIZE,
  GPU_CHUNK_VISIBILITY_PARAM_BYTE_LENGTH,
} from './gpuChunkVisibilityCullingShader.ts'
import { getGpuBufferUsage } from './webGpuStatics.ts'
import { CHUNK_SIZE } from '../voxel/chunk.ts'
import type { ChunkCoordinates } from '../world/World.ts'

const BOUNDS_WORD_COUNT = 4

function createBoundsData(
  coords: ChunkCoordinates,
  isActive: boolean
): Float32Array {
  return new Float32Array([
    coords.x * CHUNK_SIZE,
    coords.y * CHUNK_SIZE,
    coords.z * CHUNK_SIZE,
    isActive ? 1 : 0,
  ])
}

function createCullingParamData(
  camera: THREE.Camera,
  slotCount: number
): ArrayBuffer {
  const buffer = new ArrayBuffer(GPU_CHUNK_VISIBILITY_PARAM_BYTE_LENGTH)
  const floatView = new Float32Array(buffer)
  const uintView = new Uint32Array(buffer)
  const frustumPlanes = extractCameraFrustumPlanes(camera)

  floatView.set(frustumPlanes, 0)
  uintView[24] = slotCount >>> 0
  uintView[25] = Math.ceil(slotCount / 32) >>> 0
  uintView[26] = 0
  uintView[27] = 0

  return buffer
}

export type GpuChunkVisibilityInfo = {
  visibleChunkCount: number
  visibilityWordCount: number
  words: Array<number>
}

export type GpuChunkVisibilityMaterialState = {
  visibilityAttribute: THREE.StorageBufferAttribute
  visibilityWordCount: number
}

export type GpuChunkVisibilityDrawState = {
  slotCount: number
  visibilityBuffer: GPUBuffer
  visibilityWordCount: number
}

export class GpuChunkVisibilityCuller {
  private readonly bindGroup: GPUBindGroup
  private readonly boundsBuffer: GPUBuffer
  private readonly capacityValue: number
  private readonly device: GPUDevice
  private readonly paramBuffer: GPUBuffer
  private readonly pipeline: GPUComputePipeline
  private readonly visibilityAttribute: THREE.StorageBufferAttribute
  private readonly visibilityBuffer: GPUBuffer
  private readonly visibilityWordCountValue: number

  constructor(renderer: WebGPURenderer, capacity: number) {
    const backend = getWebGpuBackend(renderer)
    const gpuBufferUsage = getGpuBufferUsage()
    const shaderModule = backend.device.createShaderModule({
      code: createGpuChunkVisibilityCullingShader(),
      label: 'chunk_visibility_culling_shader',
    })

    this.capacityValue = capacity
    this.device = backend.device
    this.visibilityWordCountValue = Math.ceil(capacity / 32)
    this.pipeline = backend.device.createComputePipeline({
      compute: {
        entryPoint: 'main',
        module: shaderModule,
      },
      label: 'chunk_visibility_culling_pipeline',
      layout: 'auto',
    })
    this.boundsBuffer = backend.device.createBuffer({
      label: 'chunk_visibility_bounds',
      size: capacity * BOUNDS_WORD_COUNT * Float32Array.BYTES_PER_ELEMENT,
      usage:
        gpuBufferUsage.STORAGE |
        gpuBufferUsage.COPY_DST |
        gpuBufferUsage.COPY_SRC,
    })
    this.visibilityAttribute = new THREE.StorageBufferAttribute(
      new Uint32Array(this.visibilityWordCountValue),
      1
    )
    this.visibilityAttribute.name = 'chunk_visibility_words'
    this.visibilityBuffer = createRendererStorageAttribute(
      backend,
      this.visibilityAttribute
    )
    this.paramBuffer = backend.device.createBuffer({
      label: 'chunk_visibility_params',
      size: GPU_CHUNK_VISIBILITY_PARAM_BYTE_LENGTH,
      usage: gpuBufferUsage.UNIFORM | gpuBufferUsage.COPY_DST,
    })
    this.bindGroup = backend.device.createBindGroup({
      label: 'chunk_visibility_culling_bind_group',
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.boundsBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.visibilityBuffer,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: this.paramBuffer,
          },
        },
      ],
    })
  }

  cull(camera: THREE.Camera): void {
    this.device.queue.writeBuffer(
      this.paramBuffer,
      0,
      createCullingParamData(camera, this.capacityValue)
    )

    const encoder = this.device.createCommandEncoder({
      label: 'chunk_visibility_culling_encoder',
    })

    encoder.clearBuffer(this.visibilityBuffer)

    const pass = encoder.beginComputePass({
      label: 'chunk_visibility_culling_pass',
    })

    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.bindGroup)
    pass.dispatchWorkgroups(
      Math.ceil(this.capacityValue / GPU_CHUNK_VISIBILITY_CULL_WORKGROUP_SIZE)
    )
    pass.end()
    this.device.queue.submit([encoder.finish()])
  }

  destroy(): void {
    this.boundsBuffer.destroy()
    this.paramBuffer.destroy()
  }

  getMaterialState(): GpuChunkVisibilityMaterialState {
    return {
      visibilityAttribute: this.visibilityAttribute,
      visibilityWordCount: this.visibilityWordCount(),
    }
  }

  getDrawState(): GpuChunkVisibilityDrawState {
    return {
      slotCount: this.capacityValue,
      visibilityBuffer: this.visibilityBuffer,
      visibilityWordCount: this.visibilityWordCount(),
    }
  }

  registerChunk(handle: GpuChunkMeshHandle, coords: ChunkCoordinates): void {
    this.device.queue.writeBuffer(
      this.boundsBuffer,
      handle.slotIndex * BOUNDS_WORD_COUNT * Float32Array.BYTES_PER_ELEMENT,
      createBoundsData(coords, true)
    )
  }

  async readVisibilityInfo(): Promise<GpuChunkVisibilityInfo> {
    const words = await readGpuBufferToUint32Array(
      this.device,
      this.visibilityBuffer,
      this.visibilityWordCountValue * Uint32Array.BYTES_PER_ELEMENT,
      'chunk_visibility_words'
    )

    return {
      visibleChunkCount: countVisibleChunkSlots(words, this.capacityValue),
      visibilityWordCount: this.visibilityWordCountValue,
      words: Array.from(words),
    }
  }

  release(handle: GpuChunkMeshHandle): void {
    this.device.queue.writeBuffer(
      this.boundsBuffer,
      handle.slotIndex * BOUNDS_WORD_COUNT * Float32Array.BYTES_PER_ELEMENT,
      createBoundsData({ x: 0, y: 0, z: 0 }, false)
    )
  }

  visibilityWordCount(): number {
    return this.visibilityWordCountValue
  }
}
