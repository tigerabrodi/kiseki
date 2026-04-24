import { Chunk } from '../voxel/chunk.ts'
import type { ChunkCoordinates } from './World.ts'
import { chunkKey } from './World.ts'
import {
  getLocalVoxelIndex,
  type LocalVoxelCoordinates,
  type WorldVoxelCoordinates,
  worldVoxelToChunkVoxel,
} from './worldVoxelCoordinates.ts'

type ChunkOverrideMap = Map<number, number>

export class VoxelOverrideStore {
  private readonly overrides = new Map<string, ChunkOverrideMap>()

  applyToChunk(chunkCoords: ChunkCoordinates, chunk: Chunk): Chunk {
    const chunkOverrides = this.overrides.get(chunkKey(chunkCoords))

    if (chunkOverrides === undefined) {
      return chunk
    }

    for (const [index, materialId] of chunkOverrides) {
      chunk.voxels[index] = materialId
    }

    return chunk
  }

  chunkCount(): number {
    return this.overrides.size
  }

  getVoxel(worldCoords: WorldVoxelCoordinates): number | undefined {
    const { chunkCoords, localCoords } = worldVoxelToChunkVoxel(worldCoords)

    return this.getVoxelInChunk(chunkCoords, localCoords)
  }

  getVoxelInChunk(
    chunkCoords: ChunkCoordinates,
    localCoords: LocalVoxelCoordinates
  ): number | undefined {
    return this.overrides
      .get(chunkKey(chunkCoords))
      ?.get(getLocalVoxelIndex(localCoords))
  }

  setVoxel(worldCoords: WorldVoxelCoordinates, materialId: number): void {
    const { chunkCoords, localCoords } = worldVoxelToChunkVoxel(worldCoords)

    this.setVoxelInChunk(chunkCoords, localCoords, materialId)
  }

  setVoxelInChunk(
    chunkCoords: ChunkCoordinates,
    localCoords: LocalVoxelCoordinates,
    materialId: number
  ): void {
    const key = chunkKey(chunkCoords)
    const chunkOverrides = this.overrides.get(key) ?? new Map<number, number>()

    chunkOverrides.set(getLocalVoxelIndex(localCoords), materialId)
    this.overrides.set(key, chunkOverrides)
  }

  voxelCount(): number {
    let count = 0

    for (const chunkOverrides of this.overrides.values()) {
      count += chunkOverrides.size
    }

    return count
  }
}
