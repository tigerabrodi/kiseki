import { chunkKey, type WorldChunkEntry } from '../world/World.ts'
import { GpuChunkMeshCache } from './GpuChunkMeshCache.ts'
import { type GpuChunkVoxelCache } from './GpuChunkVoxelCache.ts'
import { destroyGpuChunkMeshHandle, GpuChunkMesher } from './GpuChunkMesher.ts'

export function createGpuChunkMeshCache(
  gpuChunkMesher: GpuChunkMesher,
  gpuVoxelCache: GpuChunkVoxelCache
): GpuChunkMeshCache {
  return new GpuChunkMeshCache((entry: WorldChunkEntry) => {
    const currentVoxelBuffer = gpuVoxelCache.getBuffer(entry.coords)

    if (currentVoxelBuffer === undefined) {
      throw new Error(
        `Missing GPU voxel buffer for meshing chunk ${chunkKey(entry.coords)}`
      )
    }

    const meshHandle = gpuChunkMesher.createMeshHandle(entry.coords)

    gpuChunkMesher.meshChunk(meshHandle, currentVoxelBuffer, {
      nx: gpuVoxelCache.getBuffer({
        x: entry.coords.x - 1,
        y: entry.coords.y,
        z: entry.coords.z,
      }),
      ny: gpuVoxelCache.getBuffer({
        x: entry.coords.x,
        y: entry.coords.y - 1,
        z: entry.coords.z,
      }),
      nz: gpuVoxelCache.getBuffer({
        x: entry.coords.x,
        y: entry.coords.y,
        z: entry.coords.z - 1,
      }),
      px: gpuVoxelCache.getBuffer({
        x: entry.coords.x + 1,
        y: entry.coords.y,
        z: entry.coords.z,
      }),
      py: gpuVoxelCache.getBuffer({
        x: entry.coords.x,
        y: entry.coords.y + 1,
        z: entry.coords.z,
      }),
      pz: gpuVoxelCache.getBuffer({
        x: entry.coords.x,
        y: entry.coords.y,
        z: entry.coords.z + 1,
      }),
    })

    return meshHandle
  }, destroyGpuChunkMeshHandle)
}
