import { CHUNK_SIZE, CHUNK_VOLUME } from '../voxel/chunk.ts'
import type { GpuVoxelBufferHandle } from './GpuChunkVoxelCache.ts'
import type { GpuLightBufferHandle } from './GpuLightSlab.ts'
import {
  createGpuLightPropagationShader,
  createGpuLightSeedShader,
  GPU_LIGHT_GENERATION_WORKGROUP_SIZE,
} from './gpuLightGenerationShader.ts'
import { GPU_LIGHT_PROPAGATION_ITERATIONS } from './lightStorageCodec.ts'
import { readGpuBufferToUint32Array } from './GpuVoxelBuffer.ts'

export type GpuLightChunkInfo = {
  byteLength: number
  byteOffset: number
  isSlabAllocated: boolean
  label: string
  litVoxelCount: number
  max: number
  min: number
  samples: {
    bottomCenter: number
    center: number
    topCenter: number
  }
  slotIndex: number
  valueCount: number
}

type GpuLightGeneratorOptions = {
  propagationIterations?: number
}

function getLightValue(values: Uint32Array, x: number, y: number, z: number) {
  return values[x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE] ?? 0
}

function assertValidPropagationIterations(iterations: number): void {
  if (!Number.isInteger(iterations) || iterations < 0 || iterations % 2 !== 0) {
    throw new RangeError(
      `GPU light propagation iterations must be a non-negative even integer, got ${iterations}`
    )
  }
}

export class GpuLightGenerator {
  private readonly device: GPUDevice
  private readonly propagationIterations: number
  private readonly propagationBindGroupLayout: GPUBindGroupLayout
  private readonly propagationPipeline: GPUComputePipeline
  private readonly seedBindGroupLayout: GPUBindGroupLayout
  private readonly seedPipeline: GPUComputePipeline

  constructor(device: GPUDevice, options: GpuLightGeneratorOptions = {}) {
    const propagationIterations =
      options.propagationIterations ?? GPU_LIGHT_PROPAGATION_ITERATIONS

    assertValidPropagationIterations(propagationIterations)

    this.device = device
    this.propagationIterations = propagationIterations
    this.seedPipeline = device.createComputePipeline({
      compute: {
        entryPoint: 'main',
        module: device.createShaderModule({
          code: createGpuLightSeedShader(),
          label: 'light_seed_shader',
        }),
      },
      label: 'light_seed_pipeline',
      layout: 'auto',
    })
    this.propagationPipeline = device.createComputePipeline({
      compute: {
        entryPoint: 'main',
        module: device.createShaderModule({
          code: createGpuLightPropagationShader(),
          label: 'light_propagation_shader',
        }),
      },
      label: 'light_propagation_pipeline',
      layout: 'auto',
    })
    this.seedBindGroupLayout = this.seedPipeline.getBindGroupLayout(0)
    this.propagationBindGroupLayout =
      this.propagationPipeline.getBindGroupLayout(0)
  }

  private createPropagationBindGroup(
    voxelHandle: GpuVoxelBufferHandle,
    readBuffer: GPUBuffer,
    readByteOffset: number,
    writeBuffer: GPUBuffer,
    writeByteOffset: number,
    lightHandle: GpuLightBufferHandle,
    iteration: number
  ): GPUBindGroup {
    return this.device.createBindGroup({
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
            buffer: readBuffer,
            offset: readByteOffset,
            size: lightHandle.byteLength,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: writeBuffer,
            offset: writeByteOffset,
            size: lightHandle.byteLength,
          },
        },
      ],
      label: `${lightHandle.label}_propagation_${iteration}_bind_group`,
      layout: this.propagationBindGroupLayout,
    })
  }

  destroy(): void {}

  getComputePassesPerChunk(): number {
    return 1 + this.propagationIterations
  }

  generateChunk(
    voxelHandle: GpuVoxelBufferHandle,
    lightHandle: GpuLightBufferHandle
  ): void {
    const encoder = this.device.createCommandEncoder({
      label: `${lightHandle.label}_generation_encoder`,
    })

    this.encodeGenerateChunk(encoder, voxelHandle, lightHandle)
    this.device.queue.submit([encoder.finish()])
  }

  encodeGenerateChunk(
    encoder: GPUCommandEncoder,
    voxelHandle: GpuVoxelBufferHandle,
    lightHandle: GpuLightBufferHandle
  ): void {
    const seedBindGroup = this.device.createBindGroup({
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
            buffer: lightHandle.buffer,
            offset: lightHandle.byteOffset,
            size: lightHandle.byteLength,
          },
        },
      ],
      label: `${lightHandle.label}_seed_bind_group`,
      layout: this.seedBindGroupLayout,
    })
    const workgroupCount = Math.ceil(
      CHUNK_VOLUME / GPU_LIGHT_GENERATION_WORKGROUP_SIZE
    )
    const seedPass = encoder.beginComputePass({
      label: `${lightHandle.label}_seed_pass`,
    })

    seedPass.setPipeline(this.seedPipeline)
    seedPass.setBindGroup(0, seedBindGroup)
    seedPass.dispatchWorkgroups(workgroupCount)
    seedPass.end()

    for (
      let iteration = 0;
      iteration < this.propagationIterations;
      iteration += 1
    ) {
      const shouldReadPrimary = iteration % 2 === 0
      const bindGroup = this.createPropagationBindGroup(
        voxelHandle,
        shouldReadPrimary ? lightHandle.buffer : lightHandle.scratchBuffer,
        shouldReadPrimary
          ? lightHandle.byteOffset
          : lightHandle.scratchByteOffset,
        shouldReadPrimary ? lightHandle.scratchBuffer : lightHandle.buffer,
        shouldReadPrimary
          ? lightHandle.scratchByteOffset
          : lightHandle.byteOffset,
        lightHandle,
        iteration
      )
      const pass = encoder.beginComputePass({
        label: `${lightHandle.label}_propagation_${iteration}_pass`,
      })

      pass.setPipeline(this.propagationPipeline)
      pass.setBindGroup(0, bindGroup)
      pass.dispatchWorkgroups(workgroupCount)
      pass.end()
    }
  }

  async readChunkInfo(
    lightHandle: GpuLightBufferHandle
  ): Promise<GpuLightChunkInfo> {
    const values = await readGpuBufferToUint32Array(
      this.device,
      lightHandle.buffer,
      lightHandle.byteLength,
      lightHandle.label,
      lightHandle.byteOffset
    )
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    let litVoxelCount = 0

    for (const value of values) {
      min = Math.min(min, value)
      max = Math.max(max, value)

      if (value > 0) {
        litVoxelCount += 1
      }
    }

    return {
      byteLength: lightHandle.byteLength,
      byteOffset: lightHandle.byteOffset,
      isSlabAllocated: lightHandle.isSlabAllocated,
      label: lightHandle.label,
      litVoxelCount,
      max,
      min,
      samples: {
        bottomCenter: getLightValue(values, 16, 0, 16),
        center: getLightValue(values, 16, 16, 16),
        topCenter: getLightValue(values, 16, 31, 16),
      },
      slotIndex: lightHandle.slotIndex,
      valueCount: lightHandle.valueCount,
    }
  }
}
