import { CHUNK_SIZE, CHUNK_VOLUME } from '../voxel/chunk.ts'
import type { GpuVoxelBufferHandle } from './GpuChunkVoxelCache.ts'
import {
  createGpuSdfGenerationShader,
  GPU_SDF_GENERATION_WORKGROUP_SIZE,
} from './gpuSdfGenerationShader.ts'
import type { GpuSdfBufferHandle } from './GpuSdfSlab.ts'
import { readGpuBufferToFloat32Array } from './GpuVoxelBuffer.ts'

export type GpuSdfChunkInfo = {
  byteLength: number
  byteOffset: number
  isSlabAllocated: boolean
  label: string
  max: number
  min: number
  negativeCount: number
  nearSurfaceCount: number
  positiveCount: number
  samples: {
    bottomCenter: number
    center: number
    topCenter: number
  }
  slotIndex: number
  valueCount: number
}

function getSdfValue(values: Float32Array, x: number, y: number, z: number) {
  return values[x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE] ?? 0
}

export class GpuSdfGenerator {
  private readonly bindGroupLayout: GPUBindGroupLayout
  private readonly device: GPUDevice
  private readonly pipeline: GPUComputePipeline

  constructor(device: GPUDevice) {
    this.device = device
    this.pipeline = device.createComputePipeline({
      compute: {
        entryPoint: 'main',
        module: device.createShaderModule({
          code: createGpuSdfGenerationShader(),
          label: 'sdf_generation_shader',
        }),
      },
      label: 'sdf_generation_pipeline',
      layout: 'auto',
    })
    this.bindGroupLayout = this.pipeline.getBindGroupLayout(0)
  }

  destroy(): void {}

  generateChunk(
    voxelHandle: GpuVoxelBufferHandle,
    sdfHandle: GpuSdfBufferHandle
  ): void {
    const encoder = this.device.createCommandEncoder({
      label: `${sdfHandle.label}_generation_encoder`,
    })

    this.encodeGenerateChunk(encoder, voxelHandle, sdfHandle)
    this.device.queue.submit([encoder.finish()])
  }

  encodeGenerateChunk(
    encoder: GPUCommandEncoder,
    voxelHandle: GpuVoxelBufferHandle,
    sdfHandle: GpuSdfBufferHandle
  ): void {
    const bindGroup = this.device.createBindGroup({
      entries: [
        {
          binding: 0,
          resource: {
            buffer: voxelHandle.buffer,
            offset: voxelHandle.byteOffset,
            size: voxelHandle.byteLength,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: sdfHandle.buffer,
            offset: sdfHandle.byteOffset,
            size: sdfHandle.byteLength,
          },
        },
      ],
      label: `${sdfHandle.label}_generation_bind_group`,
      layout: this.bindGroupLayout,
    })
    const pass = encoder.beginComputePass({
      label: `${sdfHandle.label}_generation_pass`,
    })

    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.dispatchWorkgroups(
      Math.ceil(CHUNK_VOLUME / GPU_SDF_GENERATION_WORKGROUP_SIZE)
    )
    pass.end()
  }

  async readChunkInfo(sdfHandle: GpuSdfBufferHandle): Promise<GpuSdfChunkInfo> {
    const values = await readGpuBufferToFloat32Array(
      this.device,
      sdfHandle.buffer,
      sdfHandle.byteLength,
      sdfHandle.label,
      sdfHandle.byteOffset
    )
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    let negativeCount = 0
    let nearSurfaceCount = 0
    let positiveCount = 0

    for (const value of values) {
      min = Math.min(min, value)
      max = Math.max(max, value)

      if (value < 0) {
        negativeCount += 1
      }

      if (value > 0) {
        positiveCount += 1
      }

      if (Math.abs(value) <= 1.5) {
        nearSurfaceCount += 1
      }
    }

    return {
      byteLength: sdfHandle.byteLength,
      byteOffset: sdfHandle.byteOffset,
      isSlabAllocated: sdfHandle.isSlabAllocated,
      label: sdfHandle.label,
      max,
      min,
      negativeCount,
      nearSurfaceCount,
      positiveCount,
      samples: {
        bottomCenter: getSdfValue(values, 16, 0, 16),
        center: getSdfValue(values, 16, 16, 16),
        topCenter: getSdfValue(values, 16, 31, 16),
      },
      slotIndex: sdfHandle.slotIndex,
      valueCount: sdfHandle.valueCount,
    }
  }
}
