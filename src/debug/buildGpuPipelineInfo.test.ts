import { describe, expect, it } from 'vitest'

import { Chunk } from '../voxel/chunk.ts'
import { buildGpuPipelineInfo } from './buildGpuPipelineInfo.ts'

describe('buildGpuPipelineInfo', () => {
  it('reports a fully GPU-driven pipeline when CPU chunks stay empty', () => {
    const chunkA = new Chunk()
    const chunkB = new Chunk()

    expect(
      buildGpuPipelineInfo({
        chunkEntries: [
          { chunk: chunkA, coords: { x: 0, y: 0, z: 0 } },
          { chunk: chunkB, coords: { x: 1, y: 0, z: 0 } },
        ],
        gpuMeshBufferCount: 2,
        gpuVoxelBufferCount: 2,
        overrideChunkCount: 1,
        overrideVoxelCount: 3,
        usesGpuFrustumCulling: true,
        usesGpuIndirectDrawCulling: true,
        usesGpuOcclusionCulling: true,
        usesGpuMeshGeneration: true,
        usesGpuMeshRendering: true,
        usesGpuTerrainGeneration: true,
      })
    ).toEqual({
      cpuPlaceholderChunkCount: 2,
      cpuSolidVoxelCount: 0,
      gpuMeshBufferCount: 2,
      gpuVoxelBufferCount: 2,
      isFullyGpuDriven: true,
      loadedChunkCount: 2,
      meshDataLivesOnGpu: true,
      overrideChunkCount: 1,
      overrideVoxelCount: 3,
      usesGpuFrustumCulling: true,
      usesGpuIndirectDrawCulling: true,
      usesGpuOcclusionCulling: true,
      usesGpuMeshGeneration: true,
      usesGpuMeshRendering: true,
      usesGpuTerrainGeneration: true,
      voxelDataLivesOnGpu: true,
    })
  })

  it('falls back to a mixed pipeline if CPU chunks contain solid voxels', () => {
    const chunk = new Chunk()

    chunk.set(0, 0, 0, 1)

    const info = buildGpuPipelineInfo({
      chunkEntries: [{ chunk, coords: { x: 0, y: 0, z: 0 } }],
      gpuMeshBufferCount: 1,
      gpuVoxelBufferCount: 1,
      overrideChunkCount: 0,
      overrideVoxelCount: 0,
      usesGpuFrustumCulling: false,
      usesGpuIndirectDrawCulling: false,
      usesGpuOcclusionCulling: false,
      usesGpuMeshGeneration: true,
      usesGpuMeshRendering: true,
      usesGpuTerrainGeneration: true,
    })

    expect(info.cpuPlaceholderChunkCount).toBe(0)
    expect(info.cpuSolidVoxelCount).toBe(1)
    expect(info.usesGpuFrustumCulling).toBe(false)
    expect(info.usesGpuIndirectDrawCulling).toBe(false)
    expect(info.usesGpuOcclusionCulling).toBe(false)
    expect(info.voxelDataLivesOnGpu).toBe(false)
    expect(info.isFullyGpuDriven).toBe(false)
  })
})
