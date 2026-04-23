import type { WebGPURenderer } from 'three/webgpu'

import {
  chunkKey,
  type ChunkCoordinates,
  type WorldChunkEntry,
} from '../world/World.ts'
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

export function createGpuVoxelBuffer(
  device: GPUDevice,
  entry: WorldChunkEntry
): GpuVoxelBufferHandle {
  const gpuBufferUsage = getGpuBufferUsage()
  const label = `chunk_voxels_${chunkKey(entry.coords)}`
  const data = encodeChunkVoxelsForGpu(entry.chunk)
  const buffer = device.createBuffer({
    label,
    mappedAtCreation: true,
    size: GPU_VOXEL_BUFFER_BYTE_LENGTH,
    usage:
      gpuBufferUsage.STORAGE |
      gpuBufferUsage.COPY_DST |
      gpuBufferUsage.COPY_SRC,
  })

  new Uint32Array(buffer.getMappedRange()).set(data)
  buffer.unmap()

  return {
    buffer,
    byteLength: GPU_VOXEL_BUFFER_BYTE_LENGTH,
    label,
    voxelCount: data.length,
  }
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
  label = 'gpu_buffer'
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

  encoder.copyBufferToBuffer(buffer, 0, readbackBuffer, 0, byteLength)
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
    handle.label
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

  device.queue.writeBuffer(handle.buffer, 0, data)
}

export function getGpuVoxelBufferInfo(
  coords: ChunkCoordinates,
  handle: GpuVoxelBufferHandle | undefined
): {
  byteLength: number
  coords: ChunkCoordinates
  label: string
  voxelCount: number
} | null {
  if (handle === undefined) {
    return null
  }

  return {
    byteLength: handle.byteLength,
    coords: { ...coords },
    label: handle.label,
    voxelCount: handle.voxelCount,
  }
}
