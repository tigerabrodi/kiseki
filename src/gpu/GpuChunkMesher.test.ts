import { describe, expect, it } from 'vitest'

import { buildChunkGeometryData } from '../mesh/buildChunkGeometryData.ts'
import { compareChunkMeshes } from '../mesh/compareChunkMeshes.ts'
import { CHUNK_SIZE, Chunk } from '../voxel/chunk.ts'
import {
  createGpuVoxelBuffer,
  destroyGpuVoxelBuffer,
} from './GpuVoxelBuffer.ts'
import {
  destroyGpuChunkMeshHandle,
  GpuChunkMesher,
  readGpuChunkMesh,
} from './GpuChunkMesher.ts'

const hasWebGpu =
  typeof navigator !== 'undefined' && navigator.gpu !== undefined
const itIfWebGpu = hasWebGpu ? it : it.skip

function fillChunk(chunk: Chunk, materialId: number): void {
  for (let z = 0; z < CHUNK_SIZE; z += 1) {
    for (let y = 0; y < CHUNK_SIZE; y += 1) {
      for (let x = 0; x < CHUNK_SIZE; x += 1) {
        chunk.set(x, y, z, materialId)
      }
    }
  }
}

async function createDevice(): Promise<GPUDevice> {
  const adapter = await navigator.gpu.requestAdapter()

  if (adapter === null) {
    throw new Error('Kiseki needs a WebGPU adapter for GPU mesher tests')
  }

  return adapter.requestDevice()
}

describe('GpuChunkMesher', () => {
  itIfWebGpu('matches the CPU mesher for a single voxel chunk', async () => {
    const device = await createDevice()
    const entry = {
      chunk: new Chunk(),
      coords: { x: 0, y: 0, z: 0 },
    }

    entry.chunk.set(0, 0, 0, 1)

    const voxelHandle = createGpuVoxelBuffer(device, entry)
    const mesher = new GpuChunkMesher(device)
    const meshHandle = mesher.createMeshHandle(entry.coords)
    const cpuMesh = buildChunkGeometryData(entry.chunk)

    try {
      mesher.meshChunk(meshHandle, voxelHandle, {})

      const gpuMesh = await readGpuChunkMesh(device, meshHandle)

      expect(compareChunkMeshes(cpuMesh, gpuMesh).matches).toBe(true)
    } finally {
      destroyGpuChunkMeshHandle(meshHandle)
      destroyGpuVoxelBuffer(voxelHandle)
      mesher.destroy()
    }
  })

  itIfWebGpu(
    'matches neighbor-aware CPU output when the positive x chunk is solid',
    async () => {
      const device = await createDevice()
      const entry = {
        chunk: new Chunk(),
        coords: { x: 0, y: 0, z: 0 },
      }
      const pxNeighborEntry = {
        chunk: new Chunk(),
        coords: { x: 1, y: 0, z: 0 },
      }

      fillChunk(entry.chunk, 1)
      fillChunk(pxNeighborEntry.chunk, 1)

      const voxelHandle = createGpuVoxelBuffer(device, entry)
      const pxNeighborHandle = createGpuVoxelBuffer(device, pxNeighborEntry)
      const mesher = new GpuChunkMesher(device)
      const meshHandle = mesher.createMeshHandle(entry.coords)
      const cpuMesh = buildChunkGeometryData(entry.chunk, {
        px: pxNeighborEntry.chunk,
      })

      try {
        mesher.meshChunk(meshHandle, voxelHandle, { px: pxNeighborHandle })

        const gpuMesh = await readGpuChunkMesh(device, meshHandle)

        expect(compareChunkMeshes(cpuMesh, gpuMesh).matches).toBe(true)
      } finally {
        destroyGpuChunkMeshHandle(meshHandle)
        destroyGpuVoxelBuffer(voxelHandle)
        destroyGpuVoxelBuffer(pxNeighborHandle)
        mesher.destroy()
      }
    }
  )
})
