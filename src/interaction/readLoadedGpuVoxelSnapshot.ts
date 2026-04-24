import type { GpuVoxelBufferHandle } from '../gpu/GpuChunkVoxelCache.ts'
import { readGpuVoxelChunkMaterials } from '../gpu/GpuVoxelBuffer.ts'
import type { ChunkCoordinates, WorldChunkEntry } from '../world/World.ts'
import { chunkKey } from '../world/World.ts'
import {
  getLocalVoxelIndex,
  type WorldVoxelCoordinates,
  worldVoxelToChunkVoxel,
} from '../world/worldVoxelCoordinates.ts'

export type LoadedGpuVoxelSnapshot = {
  chunkCount: number
  getMaterial: (coords: WorldVoxelCoordinates) => number
}

export async function createLoadedGpuVoxelSnapshot(
  device: GPUDevice,
  entries: Array<WorldChunkEntry>,
  getBuffer: (coords: ChunkCoordinates) => GpuVoxelBufferHandle | undefined
): Promise<LoadedGpuVoxelSnapshot> {
  const chunks = await Promise.all(
    entries.map(async (entry) => {
      const handle = getBuffer(entry.coords)

      if (handle === undefined) {
        return null
      }

      return {
        key: chunkKey(entry.coords),
        materials: await readGpuVoxelChunkMaterials(device, handle),
      }
    })
  )
  const materialMap = new Map(
    chunks.flatMap((chunk) =>
      chunk === null ? [] : [[chunk.key, chunk.materials]]
    )
  )

  return {
    chunkCount: materialMap.size,
    getMaterial: (coords) => {
      const { chunkCoords, localCoords } = worldVoxelToChunkVoxel(coords)
      const materials = materialMap.get(chunkKey(chunkCoords))

      if (materials === undefined) {
        return 0
      }

      return materials[getLocalVoxelIndex(localCoords)] ?? 0
    },
  }
}
