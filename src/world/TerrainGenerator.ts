import { createNoise2D } from 'simplex-noise'

import { CHUNK_SIZE, Chunk } from '../voxel/chunk.ts'
import type { ChunkCoordinates } from './World.ts'

type TerrainGeneratorOptions = {
  baseHeight?: number
  detailAmplitude?: number
  heightAmplitude?: number
  seed: number | string
}

function hashSeed(seed: number | string): number {
  const input = String(seed)
  let hash = 2166136261

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function createSeededRandom(seed: number | string): () => number {
  let state = hashSeed(seed) || 0x6d2b79f5

  return () => {
    state = (state + 0x6d2b79f5) >>> 0

    let result = Math.imul(state ^ (state >>> 15), state | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)

    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

export class TerrainGenerator {
  private readonly baseHeight: number
  private readonly detailAmplitude: number
  private readonly heightAmplitude: number
  private readonly noise2D: (x: number, y: number) => number

  constructor(options: TerrainGeneratorOptions) {
    this.baseHeight = options.baseHeight ?? 18
    this.detailAmplitude = options.detailAmplitude ?? 4
    this.heightAmplitude = options.heightAmplitude ?? 14
    this.noise2D = createNoise2D(createSeededRandom(options.seed))
  }

  createChunk(coords: ChunkCoordinates): Chunk {
    const chunk = new Chunk()

    for (let z = 0; z < CHUNK_SIZE; z += 1) {
      for (let x = 0; x < CHUNK_SIZE; x += 1) {
        const worldX = coords.x * CHUNK_SIZE + x
        const worldZ = coords.z * CHUNK_SIZE + z
        const surfaceHeight = this.getSurfaceHeight(worldX, worldZ)

        for (let y = 0; y < CHUNK_SIZE; y += 1) {
          const worldY = coords.y * CHUNK_SIZE + y

          if (worldY > surfaceHeight) {
            continue
          }

          const depth = surfaceHeight - worldY
          let materialId = 1

          if (depth === 0) {
            materialId = 3
          } else if (depth < 4) {
            materialId = 2
          }

          chunk.set(x, y, z, materialId)
        }
      }
    }

    return chunk
  }

  getSurfaceHeightAt(worldX: number, worldZ: number): number {
    const continentalNoise = this.noise2D(worldX * 0.018, worldZ * 0.018)
    const detailNoise = this.noise2D(
      worldX * 0.061 + 191.7,
      worldZ * 0.061 - 73.4
    )

    return Math.floor(
      this.baseHeight +
        continentalNoise * this.heightAmplitude +
        detailNoise * this.detailAmplitude
    )
  }

  private getSurfaceHeight(worldX: number, worldZ: number): number {
    return this.getSurfaceHeightAt(worldX, worldZ)
  }
}
