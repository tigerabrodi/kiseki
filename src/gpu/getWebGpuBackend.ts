import * as THREE from 'three/webgpu'
import type { WebGPURenderer } from 'three/webgpu'

type WebGpuAttributeData = {
  buffer?: GPUBuffer
}

type WebGpuBackend = {
  createIndexAttribute: (attribute: THREE.BufferAttribute) => void
  createIndirectStorageAttribute: (attribute: THREE.BufferAttribute) => void
  createStorageAttribute: (attribute: THREE.BufferAttribute) => void
  device: GPUDevice
  get: (attribute: THREE.BufferAttribute) => WebGpuAttributeData
  isWebGPUBackend?: boolean
}

function getBufferForAttribute(
  backend: WebGpuBackend,
  attribute: THREE.BufferAttribute
): GPUBuffer {
  const buffer = backend.get(attribute).buffer

  if (buffer === undefined) {
    throw new Error(
      `Missing WebGPU buffer for attribute ${attribute.name || 'unnamed'}`
    )
  }

  return buffer
}

export function getWebGpuBackend(renderer: WebGPURenderer): WebGpuBackend {
  const backend = renderer.backend as unknown as WebGpuBackend

  if (backend.isWebGPUBackend !== true || backend.device === undefined) {
    throw new Error('Kiseki requires a live WebGPU backend')
  }

  return backend
}

export function createRendererStorageAttribute(
  backend: WebGpuBackend,
  attribute: THREE.StorageBufferAttribute
): GPUBuffer {
  backend.createStorageAttribute(attribute)

  return getBufferForAttribute(backend, attribute)
}

export function createRendererIndexAttribute(
  backend: WebGpuBackend,
  attribute: THREE.StorageBufferAttribute
): GPUBuffer {
  backend.createIndexAttribute(attribute)

  return getBufferForAttribute(backend, attribute)
}

export function createRendererIndirectAttribute(
  backend: WebGpuBackend,
  attribute: THREE.IndirectStorageBufferAttribute
): GPUBuffer {
  backend.createIndirectStorageAttribute(attribute)

  return getBufferForAttribute(backend, attribute)
}
