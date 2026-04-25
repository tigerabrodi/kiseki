import {
  buildGpuChunkOcclusionGraphData,
  countGpuOcclusionVisibleSlots,
  GPU_OCCLUSION_FACE_MASK_STRIDE,
  GPU_OCCLUSION_NEIGHBOR_SLOT_STRIDE,
  GPU_OCCLUSION_SLOT_METADATA_STRIDE,
  type GpuChunkOcclusionGraphData,
  type GpuChunkOcclusionSlotInput,
} from './chunkOcclusionGraph.ts'
import {
  createGpuChunkOcclusionFaceMaskShader,
  createGpuChunkOcclusionPropagationShader,
  GPU_CHUNK_OCCLUSION_BOUNDARY_WORKGROUP_SIZE,
  GPU_CHUNK_OCCLUSION_PARAM_BYTE_LENGTH,
} from './gpuChunkOcclusionCullingShader.ts'
import { readGpuBufferToUint32Array } from './GpuVoxelBuffer.ts'
import { getGpuBufferUsage } from './webGpuStatics.ts'
import type { ChunkCoordinates } from '../world/World.ts'
import { GPU_VOXEL_BYTES_PER_VOXEL } from './voxelStorageCodec.ts'

export type GpuChunkOcclusionSyncInput = {
  coords: ChunkCoordinates
  meshSlotIndex: number
  voxelByteOffset: number
}

export type GpuChunkOcclusionState = {
  occlusionBuffer: GPUBuffer
  visibilityWordCount: number
}

export type GpuChunkOcclusionInfo = {
  activeSlotCount: number
  candidateVisibleChunkCount: number
  cullCount: number
  faceMaskWords: Array<number>
  isEnabled: boolean
  lastErrorMessage: string | null
  playerSlotIndex: number | null
  reachabilityWords: Array<number>
  visibilityWordCount: number
  words: Array<number>
}

function createParamData(
  slotCount: number,
  playerSlotIndex: number,
  visibilityWordCount: number
): Uint32Array {
  return new Uint32Array([
    slotCount >>> 0,
    playerSlotIndex >>> 0,
    visibilityWordCount >>> 0,
    0,
  ])
}

function createAllVisibleWords(slotCount: number): Uint32Array {
  const visibilityWordCount = Math.ceil(slotCount / 32)
  const words = new Uint32Array(visibilityWordCount)

  words.fill(0xffffffff)

  return words
}

export class GpuChunkOcclusionCuller {
  private activeSlotCount = 0
  private readonly capacityValue: number
  private readonly device: GPUDevice
  private readonly faceMaskBuffer: GPUBuffer
  private readonly faceMaskPipeline: GPUComputePipeline
  private cullCount = 0
  private faceMaskBindGroup: GPUBindGroup | null = null
  private isEnabledValue = false
  private readonly errorMessages: Array<string> = []
  private readonly neighborSlotBuffer: GPUBuffer
  private readonly occlusionBuffer: GPUBuffer
  private readonly paramBuffer: GPUBuffer
  private lastPlayerSlotIndex: number | null = null
  private readonly propagationPipeline: GPUComputePipeline
  private propagationBindGroup: GPUBindGroup
  private readonly reachabilityBuffer: GPUBuffer
  private readonly reachabilitySeedBuffer: GPUBuffer
  private readonly slotMetadataBuffer: GPUBuffer
  private voxelBuffer: GPUBuffer | null = null
  private readonly visibilityWordCountValue: number

  constructor(device: GPUDevice, capacity: number) {
    const gpuBufferUsage = getGpuBufferUsage()

    this.capacityValue = capacity
    this.device = device
    this.visibilityWordCountValue = Math.ceil(capacity / 32)
    const faceMaskShaderModule = device.createShaderModule({
      code: createGpuChunkOcclusionFaceMaskShader(),
      label: 'chunk_occlusion_face_mask_shader',
    })
    const propagationShaderModule = device.createShaderModule({
      code: createGpuChunkOcclusionPropagationShader(),
      label: 'chunk_occlusion_propagation_shader',
    })

    void faceMaskShaderModule.getCompilationInfo().then((info) => {
      this.captureCompilationErrors(info)
    })
    void propagationShaderModule.getCompilationInfo().then((info) => {
      this.captureCompilationErrors(info)
    })

    device.pushErrorScope('validation')
    this.faceMaskPipeline = device.createComputePipeline({
      compute: {
        entryPoint: 'main',
        module: faceMaskShaderModule,
      },
      label: 'chunk_occlusion_face_mask_pipeline',
      layout: 'auto',
    })
    void device.popErrorScope().then((error) => {
      if (error !== null) {
        this.captureError(`face mask pipeline: ${error.message}`)
      }
    })
    device.pushErrorScope('validation')
    this.propagationPipeline = device.createComputePipeline({
      compute: {
        entryPoint: 'main',
        module: propagationShaderModule,
      },
      label: 'chunk_occlusion_propagation_pipeline',
      layout: 'auto',
    })
    void device.popErrorScope().then((error) => {
      if (error !== null) {
        this.captureError(`propagation pipeline: ${error.message}`)
      }
    })
    this.slotMetadataBuffer = device.createBuffer({
      label: 'chunk_occlusion_slot_metadata',
      size:
        capacity *
        GPU_OCCLUSION_SLOT_METADATA_STRIDE *
        Uint32Array.BYTES_PER_ELEMENT,
      usage: gpuBufferUsage.STORAGE | gpuBufferUsage.COPY_DST,
    })
    this.neighborSlotBuffer = device.createBuffer({
      label: 'chunk_occlusion_neighbor_slots',
      size:
        capacity *
        GPU_OCCLUSION_NEIGHBOR_SLOT_STRIDE *
        Uint32Array.BYTES_PER_ELEMENT,
      usage: gpuBufferUsage.STORAGE | gpuBufferUsage.COPY_DST,
    })
    this.faceMaskBuffer = device.createBuffer({
      label: 'chunk_occlusion_face_masks',
      size:
        capacity *
        GPU_OCCLUSION_FACE_MASK_STRIDE *
        Uint32Array.BYTES_PER_ELEMENT,
      usage:
        gpuBufferUsage.STORAGE |
        gpuBufferUsage.COPY_DST |
        gpuBufferUsage.COPY_SRC,
    })
    this.reachabilityBuffer = device.createBuffer({
      label: 'chunk_occlusion_reachability',
      size: capacity * Uint32Array.BYTES_PER_ELEMENT,
      usage:
        gpuBufferUsage.STORAGE |
        gpuBufferUsage.COPY_DST |
        gpuBufferUsage.COPY_SRC,
    })
    this.reachabilitySeedBuffer = device.createBuffer({
      label: 'chunk_occlusion_reachability_seed',
      size: Uint32Array.BYTES_PER_ELEMENT,
      usage: gpuBufferUsage.COPY_SRC | gpuBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(
      this.reachabilitySeedBuffer,
      0,
      new Uint32Array([0x3f])
    )
    this.occlusionBuffer = device.createBuffer({
      label: 'chunk_occlusion_words',
      size: this.visibilityWordCountValue * Uint32Array.BYTES_PER_ELEMENT,
      usage:
        gpuBufferUsage.STORAGE |
        gpuBufferUsage.COPY_DST |
        gpuBufferUsage.COPY_SRC,
    })
    this.paramBuffer = device.createBuffer({
      label: 'chunk_occlusion_params',
      size: GPU_CHUNK_OCCLUSION_PARAM_BYTE_LENGTH,
      usage: gpuBufferUsage.UNIFORM | gpuBufferUsage.COPY_DST,
    })
    this.propagationBindGroup = this.createPropagationBindGroup()
    this.writeAllVisible()
  }

  private createFaceMaskBindGroup(voxelBuffer: GPUBuffer): GPUBindGroup {
    this.device.pushErrorScope('validation')

    const bindGroup = this.device.createBindGroup({
      entries: [
        {
          binding: 0,
          resource: {
            buffer: voxelBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.slotMetadataBuffer,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: this.faceMaskBuffer,
          },
        },
        {
          binding: 3,
          resource: {
            buffer: this.paramBuffer,
          },
        },
      ],
      label: 'chunk_occlusion_face_mask_bind_group',
      layout: this.faceMaskPipeline.getBindGroupLayout(0),
    })

    void this.device.popErrorScope().then((error) => {
      if (error !== null) {
        this.captureError(`face mask bind group: ${error.message}`)
      }
    })

    return bindGroup
  }

  private captureCompilationErrors(info: GPUCompilationInfo): void {
    const errorMessages = info.messages
      .filter((message) => message.type === 'error')
      .map(
        (message) =>
          `${message.lineNum}:${message.linePos} ${message.message.trim()}`
      )

    if (errorMessages.length > 0) {
      this.captureError(errorMessages.join('\n'))
    }
  }

  private captureError(message: string): void {
    this.errorMessages.push(message)

    if (this.errorMessages.length > 8) {
      this.errorMessages.shift()
    }
  }

  private createPropagationBindGroup(): GPUBindGroup {
    this.device.pushErrorScope('validation')

    const bindGroup = this.device.createBindGroup({
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.faceMaskBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: this.neighborSlotBuffer,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: this.reachabilityBuffer,
          },
        },
        {
          binding: 3,
          resource: {
            buffer: this.occlusionBuffer,
          },
        },
      ],
      label: 'chunk_occlusion_propagation_bind_group',
      layout: this.propagationPipeline.getBindGroupLayout(0),
    })

    void this.device.popErrorScope().then((error) => {
      if (error !== null) {
        this.captureError(`propagation bind group: ${error.message}`)
      }
    })

    return bindGroup
  }

  private writeAllVisible(): void {
    this.device.queue.writeBuffer(
      this.occlusionBuffer,
      0,
      createAllVisibleWords(this.capacityValue)
    )
  }

  cull(playerSlotIndex: number | null): void {
    this.lastPlayerSlotIndex = playerSlotIndex
    this.cullCount += 1

    if (
      playerSlotIndex === null ||
      playerSlotIndex < 0 ||
      playerSlotIndex >= this.capacityValue ||
      this.faceMaskBindGroup === null
    ) {
      this.writeAllVisible()
      this.isEnabledValue = false
      return
    }

    this.isEnabledValue = true
    this.device.queue.writeBuffer(
      this.paramBuffer,
      0,
      createParamData(
        this.capacityValue,
        playerSlotIndex,
        this.visibilityWordCountValue
      )
    )

    this.device.pushErrorScope('validation')

    const encoder = this.device.createCommandEncoder({
      label: 'chunk_occlusion_culling_encoder',
    })

    encoder.clearBuffer(this.reachabilityBuffer)
    encoder.clearBuffer(this.occlusionBuffer)
    encoder.clearBuffer(this.faceMaskBuffer)

    const faceMaskPass = encoder.beginComputePass({
      label: 'chunk_occlusion_face_mask_pass',
    })

    faceMaskPass.setPipeline(this.faceMaskPipeline)
    faceMaskPass.setBindGroup(0, this.faceMaskBindGroup)
    faceMaskPass.dispatchWorkgroups(
      this.capacityValue,
      Math.ceil((6 * 32 * 32) / GPU_CHUNK_OCCLUSION_BOUNDARY_WORKGROUP_SIZE)
    )
    faceMaskPass.end()
    encoder.copyBufferToBuffer(
      this.reachabilitySeedBuffer,
      0,
      this.reachabilityBuffer,
      playerSlotIndex * Uint32Array.BYTES_PER_ELEMENT,
      Uint32Array.BYTES_PER_ELEMENT
    )

    this.device.queue.submit([encoder.finish()])
    void this.device.popErrorScope().then((error) => {
      if (error !== null) {
        this.captureError(`face mask pass: ${error.message}`)
      }
    })

    this.device.pushErrorScope('validation')

    const graphEncoder = this.device.createCommandEncoder({
      label: 'chunk_occlusion_graph_encoder',
    })
    const propagationPass = graphEncoder.beginComputePass({
      label: 'chunk_occlusion_propagation_pass',
    })

    propagationPass.setPipeline(this.propagationPipeline)
    propagationPass.setBindGroup(0, this.propagationBindGroup)

    const iterationCount = Math.max(this.activeSlotCount, 1)

    for (let iteration = 0; iteration < iterationCount; iteration += 1) {
      propagationPass.dispatchWorkgroups(this.capacityValue)
    }

    propagationPass.end()
    this.device.queue.submit([graphEncoder.finish()])
    void this.device.popErrorScope().then((error) => {
      if (error !== null) {
        this.captureError(`propagation pass: ${error.message}`)
      }
    })
  }

  destroy(): void {
    this.faceMaskBuffer.destroy()
    this.neighborSlotBuffer.destroy()
    this.occlusionBuffer.destroy()
    this.paramBuffer.destroy()
    this.reachabilityBuffer.destroy()
    this.reachabilitySeedBuffer.destroy()
    this.slotMetadataBuffer.destroy()
  }

  getState(): GpuChunkOcclusionState {
    return {
      occlusionBuffer: this.occlusionBuffer,
      visibilityWordCount: this.visibilityWordCountValue,
    }
  }

  isEnabled(): boolean {
    return this.isEnabledValue
  }

  async readInfo(): Promise<GpuChunkOcclusionInfo> {
    const [words, reachabilityWords, faceMaskWords] = await Promise.all([
      readGpuBufferToUint32Array(
        this.device,
        this.occlusionBuffer,
        this.visibilityWordCountValue * Uint32Array.BYTES_PER_ELEMENT,
        'chunk_occlusion_words'
      ),
      readGpuBufferToUint32Array(
        this.device,
        this.reachabilityBuffer,
        this.capacityValue * Uint32Array.BYTES_PER_ELEMENT,
        'chunk_occlusion_reachability'
      ),
      readGpuBufferToUint32Array(
        this.device,
        this.faceMaskBuffer,
        this.capacityValue *
          GPU_OCCLUSION_FACE_MASK_STRIDE *
          Uint32Array.BYTES_PER_ELEMENT,
        'chunk_occlusion_face_masks'
      ),
    ])

    return {
      activeSlotCount: this.activeSlotCount,
      candidateVisibleChunkCount: countGpuOcclusionVisibleSlots(
        words,
        this.capacityValue
      ),
      cullCount: this.cullCount,
      faceMaskWords: Array.from(faceMaskWords),
      isEnabled: this.isEnabledValue,
      lastErrorMessage:
        this.errorMessages.length === 0
          ? null
          : this.errorMessages.join('\n\n'),
      playerSlotIndex: this.lastPlayerSlotIndex,
      reachabilityWords: Array.from(reachabilityWords),
      visibilityWordCount: this.visibilityWordCountValue,
      words: Array.from(words),
    }
  }

  syncGraph(inputs: Array<GpuChunkOcclusionSyncInput>): void {
    const graphData = this.buildGraphData(inputs)
    const firstInput = inputs[0]

    this.activeSlotCount = graphData.activeSlotCount
    this.device.queue.writeBuffer(
      this.slotMetadataBuffer,
      0,
      graphData.slotMetadata
    )
    this.device.queue.writeBuffer(
      this.neighborSlotBuffer,
      0,
      graphData.neighborSlots
    )

    if (firstInput === undefined || this.voxelBuffer === null) {
      this.faceMaskBindGroup = null
      this.isEnabledValue = false
      this.writeAllVisible()
      return
    }

    if (this.faceMaskBindGroup === null) {
      this.faceMaskBindGroup = this.createFaceMaskBindGroup(this.voxelBuffer)
    }
  }

  setVoxelBuffer(voxelBuffer: GPUBuffer | null): void {
    if (this.voxelBuffer === voxelBuffer) {
      return
    }

    this.voxelBuffer = voxelBuffer
    this.faceMaskBindGroup =
      voxelBuffer === null ? null : this.createFaceMaskBindGroup(voxelBuffer)
  }

  private buildGraphData(
    inputs: Array<GpuChunkOcclusionSyncInput>
  ): GpuChunkOcclusionGraphData {
    return buildGpuChunkOcclusionGraphData(
      inputs.map(
        (input): GpuChunkOcclusionSlotInput => ({
          coords: input.coords,
          meshSlotIndex: input.meshSlotIndex,
          voxelWordOffset: input.voxelByteOffset / GPU_VOXEL_BYTES_PER_VOXEL,
        })
      ),
      this.capacityValue
    )
  }
}
