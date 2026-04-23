import * as THREE from 'three/webgpu'
import type { WebGPURenderer } from 'three/webgpu'

import type { ChunkCoordinates } from '../world/World.ts'
import {
  createRendererIndexAttribute,
  createRendererIndirectAttribute,
  createRendererStorageAttribute,
  getWebGpuBackend,
} from './getWebGpuBackend.ts'
import {
  type GpuChunkMeshHandle,
  GPU_CHUNK_MESH_INDIRECT_DRAW_TEMPLATE,
  GPU_CHUNK_MESH_INDIRECT_BYTE_LENGTH,
  GPU_CHUNK_MESH_INDIRECT_WORD_COUNT,
  createGpuChunkMeshHandle,
} from './GpuChunkMesher.ts'
import {
  GPU_CHUNK_MESH_MAX_INDEX_COUNT,
  GPU_CHUNK_MESH_MAX_VERTEX_COUNT,
} from './gpuChunkMeshingShader.ts'

export function createRendererBackedGpuChunkMeshHandle(
  renderer: WebGPURenderer,
  coords: ChunkCoordinates
): GpuChunkMeshHandle {
  const backend = getWebGpuBackend(renderer)
  const packedDataAttribute = new THREE.StorageBufferAttribute(
    new Uint32Array(GPU_CHUNK_MESH_MAX_VERTEX_COUNT),
    1
  )
  const indexAttribute = new THREE.StorageBufferAttribute(
    new Uint32Array(GPU_CHUNK_MESH_MAX_INDEX_COUNT),
    1
  )
  const indirectAttribute = new THREE.IndirectStorageBufferAttribute(
    new Uint32Array(GPU_CHUNK_MESH_INDIRECT_DRAW_TEMPLATE),
    GPU_CHUNK_MESH_INDIRECT_WORD_COUNT
  )
  const handle = createGpuChunkMeshHandle(backend.device, coords)

  handle.vertexBuffer.destroy()
  handle.indexBuffer.destroy()
  handle.indirectBuffer.destroy()

  packedDataAttribute.name = `${handle.label}_packed_data`
  indexAttribute.name = `${handle.label}_index_data`
  indirectAttribute.name = `${handle.label}_indirect_draw`
  handle.vertexBuffer = createRendererStorageAttribute(
    backend,
    packedDataAttribute
  )
  handle.indexBuffer = createRendererIndexAttribute(backend, indexAttribute)
  handle.indirectBuffer = createRendererIndirectAttribute(
    backend,
    indirectAttribute
  )
  handle.indirectByteLength = GPU_CHUNK_MESH_INDIRECT_BYTE_LENGTH
  handle.renderBuffers = {
    indirectAttribute,
    indexAttribute,
    packedDataAttribute,
  }

  return handle
}
