import { describe, expect, it } from 'vitest'

import { compareVoxelMaterials } from '../voxel/compareVoxelMaterials.ts'
import { TerrainGenerator } from '../world/TerrainGenerator.ts'
import {
  createEmptyGpuVoxelBuffer,
  readGpuVoxelChunkMaterials,
} from './GpuVoxelBuffer.ts'
import { GpuTerrainGenerator } from './GpuTerrainGenerator.ts'

const hasWebGpu =
  typeof navigator !== 'undefined' && navigator.gpu !== undefined
const itIfWebGpu = hasWebGpu ? it : it.skip

async function createDevice(): Promise<GPUDevice> {
  const adapter = await navigator.gpu.requestAdapter()

  if (adapter === null) {
    throw new Error('Kiseki needs a WebGPU adapter for GPU terrain tests')
  }

  return adapter.requestDevice()
}

describe('GpuTerrainGenerator', () => {
  itIfWebGpu(
    'produces identical voxel data for the same seed and chunk coordinates',
    async () => {
      const device = await createDevice()
      const generator = new GpuTerrainGenerator(device, { seed: 'kiseki' })
      const coords = { x: 2, y: -1, z: 3 }
      const handleA = createEmptyGpuVoxelBuffer(device, coords)
      const handleB = createEmptyGpuVoxelBuffer(device, coords)

      try {
        generator.generateChunk(handleA, coords)
        generator.generateChunk(handleB, coords)

        const [materialsA, materialsB] = await Promise.all([
          readGpuVoxelChunkMaterials(device, handleA),
          readGpuVoxelChunkMaterials(device, handleB),
        ])

        expect([...materialsA]).toEqual([...materialsB])
      } finally {
        handleA.buffer.destroy()
        handleB.buffer.destroy()
        generator.destroy()
      }
    }
  )

  itIfWebGpu(
    'matches the CPU terrain generator for the same seed',
    async () => {
      const device = await createDevice()
      const cpuGenerator = new TerrainGenerator({ seed: 'kiseki' })
      const gpuGenerator = new GpuTerrainGenerator(device, { seed: 'kiseki' })
      const coords = { x: -1, y: 0, z: 2 }
      const handle = createEmptyGpuVoxelBuffer(device, coords)
      const cpuChunk = cpuGenerator.createChunk(coords)

      try {
        gpuGenerator.generateChunk(handle, coords)

        const gpuMaterials = await readGpuVoxelChunkMaterials(device, handle)

        expect(
          compareVoxelMaterials(cpuChunk.voxels, gpuMaterials).matches
        ).toBe(true)
      } finally {
        handle.buffer.destroy()
        gpuGenerator.destroy()
      }
    }
  )
})
