import type { WorldChunkEntry } from '../world/World.ts'

export type GpuPipelineInfo = {
  cpuPlaceholderChunkCount: number
  cpuSolidVoxelCount: number
  gpuMeshBufferCount: number
  gpuVoxelBufferCount: number
  isFullyGpuDriven: boolean
  loadedChunkCount: number
  meshDataLivesOnGpu: boolean
  overrideChunkCount: number
  overrideVoxelCount: number
  usesGpuFrustumCulling: boolean
  usesGpuIndirectDrawCulling: boolean
  usesGpuMeshGeneration: boolean
  usesGpuMeshRendering: boolean
  usesGpuTerrainGeneration: boolean
  voxelDataLivesOnGpu: boolean
}

type BuildGpuPipelineInfoInput = {
  chunkEntries: Array<WorldChunkEntry>
  gpuMeshBufferCount: number
  gpuVoxelBufferCount: number
  overrideChunkCount: number
  overrideVoxelCount: number
  usesGpuFrustumCulling: boolean
  usesGpuIndirectDrawCulling: boolean
  usesGpuMeshGeneration: boolean
  usesGpuMeshRendering: boolean
  usesGpuTerrainGeneration: boolean
}

function countSolidVoxels(entry: WorldChunkEntry): number {
  let solids = 0

  for (const materialId of entry.chunk.voxels) {
    if (materialId !== 0) {
      solids += 1
    }
  }

  return solids
}

export function buildGpuPipelineInfo(
  input: BuildGpuPipelineInfoInput
): GpuPipelineInfo {
  const loadedChunkCount = input.chunkEntries.length
  let cpuPlaceholderChunkCount = 0
  let cpuSolidVoxelCount = 0

  for (const entry of input.chunkEntries) {
    const solidVoxels = countSolidVoxels(entry)

    cpuSolidVoxelCount += solidVoxels

    if (solidVoxels === 0) {
      cpuPlaceholderChunkCount += 1
    }
  }

  const hasLoadedChunks = loadedChunkCount > 0
  const hasVoxelDataOnGpu =
    hasLoadedChunks &&
    cpuSolidVoxelCount === 0 &&
    input.gpuVoxelBufferCount === loadedChunkCount &&
    input.usesGpuTerrainGeneration
  const hasMeshDataOnGpu =
    hasLoadedChunks &&
    input.gpuMeshBufferCount === loadedChunkCount &&
    input.usesGpuMeshGeneration &&
    input.usesGpuMeshRendering

  return {
    cpuPlaceholderChunkCount,
    cpuSolidVoxelCount,
    gpuMeshBufferCount: input.gpuMeshBufferCount,
    gpuVoxelBufferCount: input.gpuVoxelBufferCount,
    isFullyGpuDriven: hasVoxelDataOnGpu && hasMeshDataOnGpu,
    loadedChunkCount,
    meshDataLivesOnGpu: hasMeshDataOnGpu,
    overrideChunkCount: input.overrideChunkCount,
    overrideVoxelCount: input.overrideVoxelCount,
    usesGpuFrustumCulling: input.usesGpuFrustumCulling,
    usesGpuIndirectDrawCulling: input.usesGpuIndirectDrawCulling,
    usesGpuMeshGeneration: input.usesGpuMeshGeneration,
    usesGpuMeshRendering: input.usesGpuMeshRendering,
    usesGpuTerrainGeneration: input.usesGpuTerrainGeneration,
    voxelDataLivesOnGpu: hasVoxelDataOnGpu,
  }
}
