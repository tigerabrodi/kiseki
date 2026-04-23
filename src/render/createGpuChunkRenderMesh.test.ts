import * as THREE from 'three/webgpu'
import { describe, expect, it } from 'vitest'

import type { GpuChunkMeshHandle } from '../gpu/GpuChunkMesher.ts'
import { CHUNK_SIZE } from '../voxel/chunk.ts'
import { createGpuChunkRenderMesh } from './createGpuChunkRenderMesh.ts'

function createFakeGpuBuffer(): GPUBuffer {
  return {} as GPUBuffer
}

function createRenderHandle(): GpuChunkMeshHandle {
  const packedDataAttribute = new THREE.StorageBufferAttribute(
    new Uint32Array(8),
    1
  )
  const indexAttribute = new THREE.StorageBufferAttribute(
    new Uint32Array(12),
    1
  )
  const indirectAttribute = new THREE.IndirectStorageBufferAttribute(
    new Uint32Array([0, 1, 0, 0, 0]),
    5
  )

  return {
    countsBuffer: createFakeGpuBuffer(),
    countsByteLength: 16,
    indirectBuffer: createFakeGpuBuffer(),
    indirectByteLength: 20,
    indexBuffer: createFakeGpuBuffer(),
    indexByteLength: 48,
    label: 'chunk_mesh_0_0_0',
    maxFaceCount: 6,
    maxIndexCount: 36,
    maxVertexCount: 24,
    renderBuffers: {
      indirectAttribute,
      indexAttribute,
      packedDataAttribute,
    },
    vertexBuffer: createFakeGpuBuffer(),
    vertexByteLength: 32,
  }
}

describe('createGpuChunkRenderMesh', () => {
  it('binds renderer-backed packed data, index, and indirect buffers', () => {
    const handle = createRenderHandle()
    const material = new THREE.MeshStandardNodeMaterial()

    const { mesh } = createGpuChunkRenderMesh(handle, material)
    const geometry = mesh.geometry

    expect(geometry.getAttribute('packedData')).toBe(
      handle.renderBuffers?.packedDataAttribute
    )
    expect(geometry.getIndex()).toBe(handle.renderBuffers?.indexAttribute)
    expect(geometry.getIndirect()).toBe(handle.renderBuffers?.indirectAttribute)
    expect(geometry.indirectOffset).toBe(0)
    expect(mesh.frustumCulled).toBe(true)
    expect(geometry.boundingBox?.min.toArray()).toEqual([0, 0, 0])
    expect(geometry.boundingBox?.max.toArray()).toEqual([
      CHUNK_SIZE,
      CHUNK_SIZE,
      CHUNK_SIZE,
    ])
    expect(geometry.boundingSphere?.radius).toBeGreaterThan(0)
  })

  it('throws when the GPU handle is missing renderer-owned buffers', () => {
    const material = new THREE.MeshStandardNodeMaterial()

    expect(() =>
      createGpuChunkRenderMesh(
        {
          countsBuffer: createFakeGpuBuffer(),
          countsByteLength: 16,
          indirectBuffer: createFakeGpuBuffer(),
          indirectByteLength: 20,
          indexBuffer: createFakeGpuBuffer(),
          indexByteLength: 48,
          label: 'chunk_mesh_missing',
          maxFaceCount: 6,
          maxIndexCount: 36,
          maxVertexCount: 24,
          vertexBuffer: createFakeGpuBuffer(),
          vertexByteLength: 32,
        },
        material
      )
    ).toThrowError(
      'Missing renderer-backed mesh buffers for chunk_mesh_missing'
    )
  })
})
