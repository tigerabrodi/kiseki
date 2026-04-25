import type { GpuChunkMeshIndirectDrawState } from './GpuChunkMeshSlab.ts'
import type { GpuChunkVisibilityDrawState } from './GpuChunkVisibilityCuller.ts'
import { readGpuBufferToUint32Array } from './GpuVoxelBuffer.ts'
import {
  GPU_CHUNK_INDIRECT_DRAW_CULL_WORKGROUP_SIZE,
  GPU_CHUNK_INDIRECT_DRAW_PARAM_BYTE_LENGTH,
  createGpuChunkIndirectDrawCullingShader,
} from './gpuChunkIndirectDrawCullingShader.ts'
import { countActiveIndirectDraws } from './indirectDrawData.ts'
import { getGpuBufferUsage } from './webGpuStatics.ts'

function createParamData(
  slotCount: number,
  visibilityWordCount: number
): Uint32Array {
  return new Uint32Array([slotCount >>> 0, visibilityWordCount >>> 0, 0, 0])
}

export type GpuIndirectDrawInfo = {
  activeDrawCount: number
  commandCount: number
  words: Array<number>
}

export class GpuChunkIndirectDrawCuller {
  private readonly bindGroup: GPUBindGroup
  private readonly device: GPUDevice
  private readonly drawState: GpuChunkMeshIndirectDrawState
  private readonly paramBuffer: GPUBuffer
  private readonly pipeline: GPUComputePipeline
  private readonly visibilityState: GpuChunkVisibilityDrawState

  constructor(
    device: GPUDevice,
    visibilityState: GpuChunkVisibilityDrawState,
    drawState: GpuChunkMeshIndirectDrawState
  ) {
    const gpuBufferUsage = getGpuBufferUsage()
    const shaderModule = device.createShaderModule({
      code: createGpuChunkIndirectDrawCullingShader(),
      label: 'chunk_indirect_draw_culling_shader',
    })

    this.device = device
    this.drawState = drawState
    this.visibilityState = visibilityState
    this.pipeline = device.createComputePipeline({
      compute: {
        entryPoint: 'main',
        module: shaderModule,
      },
      label: 'chunk_indirect_draw_culling_pipeline',
      layout: 'auto',
    })
    this.paramBuffer = device.createBuffer({
      label: 'chunk_indirect_draw_culling_params',
      size: GPU_CHUNK_INDIRECT_DRAW_PARAM_BYTE_LENGTH,
      usage: gpuBufferUsage.UNIFORM | gpuBufferUsage.COPY_DST,
    })
    this.bindGroup = device.createBindGroup({
      label: 'chunk_indirect_draw_culling_bind_group',
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: visibilityState.visibilityBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: drawState.indirectTemplateBuffer,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: drawState.indirectBuffer,
          },
        },
        {
          binding: 3,
          resource: {
            buffer: this.paramBuffer,
          },
        },
      ],
    })
  }

  apply(): void {
    this.device.queue.writeBuffer(
      this.paramBuffer,
      0,
      createParamData(
        this.drawState.slotCount,
        this.visibilityState.visibilityWordCount
      )
    )

    const encoder = this.device.createCommandEncoder({
      label: 'chunk_indirect_draw_culling_encoder',
    })
    const pass = encoder.beginComputePass({
      label: 'chunk_indirect_draw_culling_pass',
    })

    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.bindGroup)
    pass.dispatchWorkgroups(
      Math.ceil(
        this.drawState.slotCount / GPU_CHUNK_INDIRECT_DRAW_CULL_WORKGROUP_SIZE
      )
    )
    pass.end()
    this.device.queue.submit([encoder.finish()])
  }

  destroy(): void {
    this.paramBuffer.destroy()
  }

  async readDrawInfo(): Promise<GpuIndirectDrawInfo> {
    const commandByteLength =
      this.drawState.slotCount * this.drawState.indirectByteLength
    const words = await readGpuBufferToUint32Array(
      this.device,
      this.drawState.indirectBuffer,
      commandByteLength,
      'chunk_indirect_draw_args'
    )

    return {
      activeDrawCount: countActiveIndirectDraws(
        words,
        this.drawState.slotCount
      ),
      commandCount: this.drawState.slotCount,
      words: Array.from(words),
    }
  }
}
