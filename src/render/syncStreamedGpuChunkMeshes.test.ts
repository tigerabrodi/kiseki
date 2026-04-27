import * as THREE from 'three/webgpu'
import { describe, expect, it, vi } from 'vitest'

import type { GpuChunkMeshCache } from '../gpu/GpuChunkMeshCache.ts'
import type { GpuChunkMeshHandle } from '../gpu/GpuChunkMesher.ts'
import type { GpuChunkVoxelCache } from '../gpu/GpuChunkVoxelCache.ts'
import { Chunk } from '../voxel/chunk.ts'
import { syncStreamedGpuChunkMeshes } from './syncStreamedGpuChunkMeshes.ts'

function createFakeGpuBuffer(): GPUBuffer {
  return {} as GPUBuffer
}

function createRenderHandle(slotIndex: number): GpuChunkMeshHandle {
  return {
    baseVertex: 0,
    countsBuffer: createFakeGpuBuffer(),
    countsByteLength: 16,
    countsByteOffset: 0,
    firstIndex: 0,
    indexBuffer: createFakeGpuBuffer(),
    indexByteLength: 0,
    indexByteOffset: 0,
    indirectBuffer: createFakeGpuBuffer(),
    indirectByteLength: 20,
    indirectByteOffset: slotIndex * 20,
    isSlabAllocated: true,
    label: `chunk_mesh_slot_${slotIndex}`,
    maxFaceCount: 6,
    maxIndexCount: 36,
    maxVertexCount: 24,
    renderBuffers: {
      indexAttribute: new THREE.StorageBufferAttribute(new Uint32Array(36), 1),
      indirectAttribute: new THREE.IndirectStorageBufferAttribute(
        new Uint32Array(5),
        5
      ),
      packedDataAttribute: new THREE.StorageBufferAttribute(
        new Uint32Array(24),
        1
      ),
    },
    slotIndex,
    vertexBuffer: createFakeGpuBuffer(),
    vertexByteLength: 0,
    vertexByteOffset: 0,
  }
}

describe('syncStreamedGpuChunkMeshes', () => {
  it('pools renderer geometries by slot instead of disposing shared slab attributes on unload', () => {
    const coords = { x: 0, y: 0, z: 0 }
    const entry = { chunk: new Chunk(), coords }
    const handle = createRenderHandle(3)
    const chunkMeshCache = {
      getMesh: () => handle,
      sync: vi.fn(),
    } as unknown as GpuChunkMeshCache
    const chunkMeshMap = new Map<
      string,
      THREE.Mesh<THREE.BufferGeometry, THREE.Material | Array<THREE.Material>>
    >()
    const chunkMeshSlotMap = new Map<
      number,
      THREE.Mesh<THREE.BufferGeometry, THREE.Material | Array<THREE.Material>>
    >()
    const worldGroup = new THREE.Group()
    const commonOptions = {
      chunkMeshCache,
      chunkMesher: {} as GpuChunkMeshCache as never,
      chunkMeshMap,
      chunkMeshSlotMap,
      gpuVoxelCache: {} as GpuChunkVoxelCache,
      material: new THREE.MeshStandardNodeMaterial(),
      worldGroup,
      worldHasChunk: () => false,
    }

    syncStreamedGpuChunkMeshes({
      ...commonOptions,
      update: { loaded: [entry], unloaded: [] },
    })

    const pooledMesh = chunkMeshSlotMap.get(handle.slotIndex)

    if (pooledMesh === undefined) {
      throw new Error('Expected a pooled chunk mesh')
    }

    const geometryDispose = vi.spyOn(pooledMesh.geometry, 'dispose')

    syncStreamedGpuChunkMeshes({
      ...commonOptions,
      update: { loaded: [], unloaded: [entry] },
    })

    syncStreamedGpuChunkMeshes({
      ...commonOptions,
      update: { loaded: [entry], unloaded: [] },
    })

    expect(geometryDispose).not.toHaveBeenCalled()
    expect(chunkMeshSlotMap.get(handle.slotIndex)).toBe(pooledMesh)
    expect(worldGroup.children).toContain(pooledMesh)
  })

  it('batches stream remeshes into one GPU mesher submission', () => {
    const coords = { x: 0, y: 0, z: 0 }
    const entry = { chunk: new Chunk(), coords }
    const handle = createRenderHandle(4)
    const meshChunks = vi.fn()
    const chunkMeshCache = {
      getMesh: () => handle,
      sync: vi.fn(),
    } as unknown as GpuChunkMeshCache
    const gpuVoxelCache = {
      getBuffer: () => ({
        buffer: createFakeGpuBuffer(),
        byteLength: 4,
        byteOffset: 0,
        label: 'voxel',
        slotIndex: 0,
      }),
    } as unknown as GpuChunkVoxelCache

    syncStreamedGpuChunkMeshes({
      chunkMeshCache,
      chunkMesher: { meshChunks } as never,
      chunkMeshMap: new Map(),
      chunkMeshSlotMap: new Map(),
      gpuVoxelCache,
      material: new THREE.MeshStandardNodeMaterial(),
      update: { loaded: [entry], unloaded: [] },
      worldGroup: new THREE.Group(),
      worldHasChunk: (candidate) =>
        candidate.x === coords.x &&
        candidate.y === coords.y &&
        candidate.z === coords.z,
    })

    expect(meshChunks).toHaveBeenCalledTimes(1)
    expect(meshChunks.mock.calls[0]?.[0]).toHaveLength(1)
  })

  it('encodes stream remeshes into a shared command encoder without submitting', () => {
    const coords = { x: 0, y: 0, z: 0 }
    const entry = { chunk: new Chunk(), coords }
    const encoder = {} as GPUCommandEncoder
    const encodeMeshChunks = vi.fn()
    const meshChunks = vi.fn()
    const chunkMeshCache = {
      getMesh: () => createRenderHandle(5),
      sync: vi.fn(),
    } as unknown as GpuChunkMeshCache
    const gpuVoxelCache = {
      getBuffer: () => ({
        buffer: createFakeGpuBuffer(),
        byteLength: 4,
        byteOffset: 0,
        label: 'voxel',
        slotIndex: 0,
      }),
    } as unknown as GpuChunkVoxelCache

    const result = syncStreamedGpuChunkMeshes({
      chunkMeshCache,
      chunkMesher: { encodeMeshChunks, meshChunks } as never,
      chunkMeshMap: new Map(),
      chunkMeshSlotMap: new Map(),
      encoder,
      gpuVoxelCache,
      material: new THREE.MeshStandardNodeMaterial(),
      update: { loaded: [entry], unloaded: [] },
      worldGroup: new THREE.Group(),
      worldHasChunk: (candidate) =>
        candidate.x === coords.x &&
        candidate.y === coords.y &&
        candidate.z === coords.z,
    })

    expect(encodeMeshChunks).toHaveBeenCalledTimes(1)
    expect(encodeMeshChunks.mock.calls[0]?.[0]).toBe(encoder)
    expect(encodeMeshChunks.mock.calls[0]?.[1]).toHaveLength(1)
    expect(meshChunks).not.toHaveBeenCalled()
    expect(result.gpuSubmissionCount).toBe(0)
  })
})
