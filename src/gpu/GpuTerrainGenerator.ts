import type { ChunkCoordinates } from '../world/World.ts'
import {
  createTerrainGenerationSettings,
  type TerrainGenerationOptions,
  type TerrainGenerationSettings,
} from '../world/terrainNoise.ts'
import type { GpuVoxelBufferHandle } from './GpuChunkVoxelCache.ts'
import {
  createGpuTerrainGenerationShader,
  GPU_TERRAIN_GENERATION_DISPATCH_SIZE,
  GPU_TERRAIN_GENERATION_PARAM_BYTE_LENGTH,
} from './gpuTerrainGenerationShader.ts'
import { getGpuBufferUsage, getGpuShaderStage } from './webGpuStatics.ts'

function createTerrainParamData(
  coords: ChunkCoordinates,
  settings: TerrainGenerationSettings
): ArrayBuffer {
  const buffer = new ArrayBuffer(GPU_TERRAIN_GENERATION_PARAM_BYTE_LENGTH)
  const intView = new Int32Array(buffer)
  const floatView = new Float32Array(buffer)
  const uintView = new Uint32Array(buffer)

  intView[0] = coords.x
  intView[1] = coords.y
  intView[2] = coords.z
  intView[3] = 0
  floatView[4] = settings.baseHeight
  floatView[5] = settings.heightAmplitude
  floatView[6] = settings.detailAmplitude
  floatView[7] = settings.continentalFrequency
  floatView[8] = settings.detailFrequency
  floatView[9] = settings.detailOffsetX
  floatView[10] = settings.detailOffsetZ
  floatView[11] = 0
  uintView[12] = settings.seedHash
  uintView[13] = settings.detailSeedHash
  uintView[14] = 0
  uintView[15] = 0

  return buffer
}

export class GpuTerrainGenerator {
  private readonly bindGroupLayout: GPUBindGroupLayout
  private readonly device: GPUDevice
  private lastErrorMessage: string | null = null
  private readonly paramBuffer: GPUBuffer
  private readonly pipeline: GPUComputePipeline
  private readonly settings: TerrainGenerationSettings

  constructor(device: GPUDevice, options: TerrainGenerationOptions) {
    this.device = device
    this.settings = createTerrainGenerationSettings(options)
    const gpuBufferUsage = getGpuBufferUsage()
    const gpuShaderStage = getGpuShaderStage()
    const shaderModule = device.createShaderModule({
      label: 'terrain_generation_shader',
      code: createGpuTerrainGenerationShader(),
    })

    void shaderModule.getCompilationInfo().then((info) => {
      const errorMessages = info.messages
        .filter((message) => message.type === 'error')
        .map(
          (message) =>
            `${message.lineNum}:${message.linePos} ${message.message.trim()}`
        )

      if (errorMessages.length > 0) {
        this.lastErrorMessage = errorMessages.join('\n')
      }
    })

    this.bindGroupLayout = device.createBindGroupLayout({
      label: 'terrain_generation_bind_group_layout',
      entries: [
        {
          binding: 0,
          buffer: {
            type: 'storage',
          },
          visibility: gpuShaderStage.COMPUTE,
        },
        {
          binding: 1,
          buffer: {
            type: 'uniform',
          },
          visibility: gpuShaderStage.COMPUTE,
        },
      ],
    })
    device.pushErrorScope('validation')
    this.pipeline = device.createComputePipeline({
      label: 'terrain_generation_pipeline',
      compute: {
        entryPoint: 'main',
        module: shaderModule,
      },
      layout: device.createPipelineLayout({
        label: 'terrain_generation_pipeline_layout',
        bindGroupLayouts: [this.bindGroupLayout],
      }),
    })
    void device.popErrorScope().then((error) => {
      if (error !== null) {
        this.lastErrorMessage = error.message
      }
    })
    this.paramBuffer = device.createBuffer({
      label: 'terrain_generation_params',
      size: GPU_TERRAIN_GENERATION_PARAM_BYTE_LENGTH,
      usage: gpuBufferUsage.UNIFORM | gpuBufferUsage.COPY_DST,
    })
  }

  destroy(): void {
    this.paramBuffer.destroy()
  }

  getLastErrorMessage(): string | null {
    return this.lastErrorMessage
  }

  generateChunk(
    voxelHandle: GpuVoxelBufferHandle,
    coords: ChunkCoordinates
  ): void {
    this.device.pushErrorScope('validation')
    this.device.queue.writeBuffer(
      this.paramBuffer,
      0,
      createTerrainParamData(coords, this.settings)
    )

    const bindGroup = this.device.createBindGroup({
      label: `${voxelHandle.label}_terrain_generation_bind_group`,
      layout: this.bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: voxelHandle.buffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.paramBuffer,
          },
        },
      ],
    })
    const encoder = this.device.createCommandEncoder({
      label: `${voxelHandle.label}_terrain_generation_encoder`,
    })
    const pass = encoder.beginComputePass({
      label: `${voxelHandle.label}_terrain_generation_pass`,
    })

    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.dispatchWorkgroups(
      GPU_TERRAIN_GENERATION_DISPATCH_SIZE,
      GPU_TERRAIN_GENERATION_DISPATCH_SIZE,
      GPU_TERRAIN_GENERATION_DISPATCH_SIZE
    )
    pass.end()
    this.device.queue.submit([encoder.finish()])
    void this.device.popErrorScope().then((error) => {
      if (error !== null) {
        this.lastErrorMessage = error.message
      }
    })
  }
}
