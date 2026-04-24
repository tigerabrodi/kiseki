import type { WebGPURenderer } from 'three/webgpu'

import {
  chunkKey,
  type ChunkCoordinates,
  type WorldChunkEntry,
} from '../world/World.ts'
import type { LocalVoxelCoordinates } from '../world/worldVoxelCoordinates.ts'
import { getLocalVoxelIndex } from '../world/worldVoxelCoordinates.ts'
import {
  decodeGpuVoxelData,
  encodeChunkVoxelsForGpu,
  GPU_VOXEL_BUFFER_BYTE_LENGTH,
} from './voxelStorageCodec.ts'
import type { GpuVoxelBufferHandle } from './GpuChunkVoxelCache.ts'
import { getGpuBufferUsage, getGpuMapMode } from './webGpuStatics.ts'

type WebGpuBackendWithDevice = {
  device?: GPUDevice
  isWebGPUBackend?: boolean
}

function createVoxelBuffer(
  device: GPUDevice,
  label: string,
  initialData: Uint32Array
): GpuVoxelBufferHandle {
  const gpuBufferUsage = getGpuBufferUsage()
  const buffer = device.createBuffer({
    label,
    mappedAtCreation: true,
    size: GPU_VOXEL_BUFFER_BYTE_LENGTH,
    usage:
      gpuBufferUsage.STORAGE |
      gpuBufferUsage.COPY_DST |
      gpuBufferUsage.COPY_SRC,
  })

  new Uint32Array(buffer.getMappedRange()).set(initialData)
  buffer.unmap()

  return {
    buffer,
    byteOffset: 0,
    byteLength: GPU_VOXEL_BUFFER_BYTE_LENGTH,
    isSlabAllocated: false,
    label,
    slotIndex: 0,
    voxelCount: initialData.length,
  }
}

export function createGpuVoxelBuffer(
  device: GPUDevice,
  entry: WorldChunkEntry
): GpuVoxelBufferHandle {
  const label = `chunk_voxels_${chunkKey(entry.coords)}`
  const data = encodeChunkVoxelsForGpu(entry.chunk)

  return createVoxelBuffer(device, label, data)
}

export function createEmptyGpuVoxelBuffer(
  device: GPUDevice,
  coords: ChunkCoordinates
): GpuVoxelBufferHandle {
  return createVoxelBuffer(
    device,
    `chunk_voxels_${chunkKey(coords)}`,
    new Uint32Array(
      GPU_VOXEL_BUFFER_BYTE_LENGTH / Uint32Array.BYTES_PER_ELEMENT
    )
  )
}

export function destroyGpuVoxelBuffer(handle: GpuVoxelBufferHandle): void {
  handle.buffer.destroy()
}

export function getWebGpuDevice(renderer: WebGPURenderer): GPUDevice {
  const backend = renderer.backend as WebGpuBackendWithDevice

  if (backend.isWebGPUBackend !== true || backend.device === undefined) {
    throw new Error(
      'Kiseki requires a live WebGPU device for GPU voxel storage'
    )
  }

  return backend.device
}

export async function readGpuBufferToUint32Array(
  device: GPUDevice,
  buffer: GPUBuffer,
  byteLength: number,
  label = 'gpu_buffer',
  byteOffset = 0
): Promise<Uint32Array> {
  if (byteLength === 0) {
    return new Uint32Array()
  }

  const gpuBufferUsage = getGpuBufferUsage()
  const gpuMapMode = getGpuMapMode()
  const readbackBuffer = device.createBuffer({
    label: `${label}_readback`,
    size: byteLength,
    usage: gpuBufferUsage.COPY_DST | gpuBufferUsage.MAP_READ,
  })

  const encoder = device.createCommandEncoder({
    label: `${label}_readback_encoder`,
  })

  encoder.copyBufferToBuffer(buffer, byteOffset, readbackBuffer, 0, byteLength)
  device.queue.submit([encoder.finish()])
  await readbackBuffer.mapAsync(gpuMapMode.READ, 0, byteLength)

  const copy = readbackBuffer.getMappedRange(0, byteLength).slice(0)
  readbackBuffer.unmap()
  readbackBuffer.destroy()

  return new Uint32Array(copy)
}

export async function readGpuVoxelBuffer(
  device: GPUDevice,
  handle: GpuVoxelBufferHandle
): Promise<Uint32Array> {
  return readGpuBufferToUint32Array(
    device,
    handle.buffer,
    handle.byteLength,
    handle.label,
    handle.byteOffset
  )
}

export async function readGpuVoxelChunkMaterials(
  device: GPUDevice,
  handle: GpuVoxelBufferHandle
): Promise<Uint8Array> {
  return decodeGpuVoxelData(await readGpuVoxelBuffer(device, handle))
}

export function uploadChunkToGpuVoxelBuffer(
  device: GPUDevice,
  entry: WorldChunkEntry,
  handle: GpuVoxelBufferHandle
): void {
  const data = encodeChunkVoxelsForGpu(entry.chunk)

  if (data.byteLength !== handle.byteLength) {
    throw new RangeError(
      `GPU voxel buffer size mismatch for ${handle.label}: expected ${handle.byteLength} bytes, got ${data.byteLength}`
    )
  }

  device.queue.writeBuffer(handle.buffer, handle.byteOffset, data)
}

export function writeGpuVoxelMaterial(
  device: GPUDevice,
  handle: GpuVoxelBufferHandle,
  localCoords: LocalVoxelCoordinates,
  materialId: number
): void {
  if (!Number.isInteger(materialId) || materialId < 0 || materialId > 0xff) {
    throw new RangeError(
      `materialId must be an integer between 0 and 255, got ${materialId}`
    )
  }

  device.queue.writeBuffer(
    handle.buffer,
    handle.byteOffset +
      getLocalVoxelIndex(localCoords) * Uint32Array.BYTES_PER_ELEMENT,
    new Uint32Array([materialId])
  )
}

export function getGpuVoxelBufferInfo(
  coords: ChunkCoordinates,
  handle: GpuVoxelBufferHandle | undefined
): {
  byteOffset: number
  byteLength: number
  coords: ChunkCoordinates
  isSlabAllocated: boolean
  label: string
  slotIndex: number
  voxelCount: number
} | null {
  if (handle === undefined) {
    return null
  }

  return {
    byteOffset: handle.byteOffset,
    byteLength: handle.byteLength,
    coords: { ...coords },
    isSlabAllocated: handle.isSlabAllocated,
    label: handle.label,
    slotIndex: handle.slotIndex,
    voxelCount: handle.voxelCount,
  }
}
