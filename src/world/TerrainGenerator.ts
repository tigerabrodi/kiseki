import { Chunk } from '../voxel/chunk.ts'
import type { ChunkCoordinates } from './World.ts'
import {
  createTerrainGenerationSettings,
  fillChunkWithTerrain,
  getSurfaceHeightAt,
  type TerrainGenerationSettings,
  type TerrainGenerationOptions,
} from './terrainNoise.ts'

export class TerrainGenerator {
  private readonly settings: TerrainGenerationSettings

  constructor(options: TerrainGenerationOptions) {
    this.settings = createTerrainGenerationSettings(options)
  }

  createChunk(coords: ChunkCoordinates): Chunk {
    const chunk = new Chunk()

    return fillChunkWithTerrain(chunk, coords, this.settings)
  }

  getSurfaceHeightAt(worldX: number, worldZ: number): number {
    return getSurfaceHeightAt(worldX, worldZ, this.settings)
  }
}
