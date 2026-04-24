import type { GpuChunkMeshCache } from './GpuChunkMeshCache.ts'
import {
  type GpuVoxelBufferNeighbors,
  GpuChunkMesher,
} from './GpuChunkMesher.ts'
import type { GpuChunkVoxelCache } from './GpuChunkVoxelCache.ts'
import type { ChunkCoordinates } from '../world/World.ts'

export function getGpuVoxelBufferNeighbors(
  gpuVoxelCache: GpuChunkVoxelCache,
  coords: ChunkCoordinates
): GpuVoxelBufferNeighbors {
  return {
    nx: gpuVoxelCache.getBuffer({ x: coords.x - 1, y: coords.y, z: coords.z }),
    ny: gpuVoxelCache.getBuffer({ x: coords.x, y: coords.y - 1, z: coords.z }),
    nz: gpuVoxelCache.getBuffer({ x: coords.x, y: coords.y, z: coords.z - 1 }),
    px: gpuVoxelCache.getBuffer({ x: coords.x + 1, y: coords.y, z: coords.z }),
    py: gpuVoxelCache.getBuffer({ x: coords.x, y: coords.y + 1, z: coords.z }),
    pz: gpuVoxelCache.getBuffer({ x: coords.x, y: coords.y, z: coords.z + 1 }),
  }
}

export function remeshGpuChunkAtCoords(
  gpuChunkMesher: GpuChunkMesher,
  gpuChunkMeshCache: GpuChunkMeshCache,
  gpuVoxelCache: GpuChunkVoxelCache,
  coords: ChunkCoordinates
): boolean {
  const meshHandle = gpuChunkMeshCache.getMesh(coords)
  const currentVoxelBuffer = gpuVoxelCache.getBuffer(coords)

  if (meshHandle === undefined || currentVoxelBuffer === undefined) {
    return false
  }

  gpuChunkMesher.meshChunk(
    meshHandle,
    currentVoxelBuffer,
    getGpuVoxelBufferNeighbors(gpuVoxelCache, coords)
  )

  return true
}
