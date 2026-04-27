import type { GpuChunkMeshCache } from './GpuChunkMeshCache.ts'
import {
  type GpuVoxelBufferNeighbors,
  type GpuChunkMeshJob,
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

export function createGpuChunkRemeshJob(
  gpuChunkMeshCache: GpuChunkMeshCache,
  gpuVoxelCache: GpuChunkVoxelCache,
  coords: ChunkCoordinates
): GpuChunkMeshJob | null {
  const handle = gpuChunkMeshCache.getMesh(coords)
  const currentVoxelBuffer = gpuVoxelCache.getBuffer(coords)

  if (handle === undefined || currentVoxelBuffer === undefined) {
    return null
  }

  return {
    currentVoxelBuffer,
    handle,
    neighbors: getGpuVoxelBufferNeighbors(gpuVoxelCache, coords),
  }
}

export function remeshGpuChunksAtCoords(
  gpuChunkMesher: GpuChunkMesher,
  gpuChunkMeshCache: GpuChunkMeshCache,
  gpuVoxelCache: GpuChunkVoxelCache,
  chunkCoords: ReadonlyArray<ChunkCoordinates>
): number {
  const jobs = createGpuChunkRemeshJobs(
    gpuChunkMeshCache,
    gpuVoxelCache,
    chunkCoords
  )

  if (jobs.length === 0) {
    return 0
  }

  gpuChunkMesher.meshChunks(jobs)

  return jobs.length
}

export function createGpuChunkRemeshJobs(
  gpuChunkMeshCache: GpuChunkMeshCache,
  gpuVoxelCache: GpuChunkVoxelCache,
  chunkCoords: ReadonlyArray<ChunkCoordinates>
): Array<GpuChunkMeshJob> {
  return chunkCoords.flatMap((coords) => {
    const job = createGpuChunkRemeshJob(
      gpuChunkMeshCache,
      gpuVoxelCache,
      coords
    )

    return job === null ? [] : [job]
  })
}

export function encodeRemeshGpuChunksAtCoords(
  encoder: GPUCommandEncoder,
  gpuChunkMesher: GpuChunkMesher,
  gpuChunkMeshCache: GpuChunkMeshCache,
  gpuVoxelCache: GpuChunkVoxelCache,
  chunkCoords: ReadonlyArray<ChunkCoordinates>
): number {
  const jobs = createGpuChunkRemeshJobs(
    gpuChunkMeshCache,
    gpuVoxelCache,
    chunkCoords
  )

  if (jobs.length === 0) {
    return 0
  }

  gpuChunkMesher.encodeMeshChunks(encoder, jobs)

  return jobs.length
}
