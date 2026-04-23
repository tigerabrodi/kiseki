import { CHUNK_SIZE, Chunk } from '../voxel/chunk.ts'
import type { ChunkCoordinates } from './World.ts'

const DIAGONAL_GRADIENT_COMPONENT = Math.SQRT1_2
const GRADIENT_DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [DIAGONAL_GRADIENT_COMPONENT, DIAGONAL_GRADIENT_COMPONENT],
  [-DIAGONAL_GRADIENT_COMPONENT, DIAGONAL_GRADIENT_COMPONENT],
  [DIAGONAL_GRADIENT_COMPONENT, -DIAGONAL_GRADIENT_COMPONENT],
  [-DIAGONAL_GRADIENT_COMPONENT, -DIAGONAL_GRADIENT_COMPONENT],
] as const
const DEFAULT_BASE_HEIGHT = 18
const DEFAULT_DETAIL_AMPLITUDE = 4
const DEFAULT_HEIGHT_AMPLITUDE = 14
const DEFAULT_CONTINENTAL_FREQUENCY = 0.018
const DEFAULT_DETAIL_FREQUENCY = 0.061
const DEFAULT_DETAIL_OFFSET_X = 191.7
const DEFAULT_DETAIL_OFFSET_Z = -73.4
const DETAIL_SEED_SALT = 0x9e3779b9

export type TerrainGenerationOptions = {
  baseHeight?: number
  continentalFrequency?: number
  detailAmplitude?: number
  detailFrequency?: number
  detailOffsetX?: number
  detailOffsetZ?: number
  heightAmplitude?: number
  seed: number | string
}

export type TerrainGenerationSettings = {
  baseHeight: number
  continentalFrequency: number
  detailAmplitude: number
  detailFrequency: number
  detailOffsetX: number
  detailOffsetZ: number
  detailSeedHash: number
  heightAmplitude: number
  seedHash: number
}

function fade(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10)
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha
}

function mixHash(value: number): number {
  let hash = value >>> 0

  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x7feb352d)
  hash ^= hash >>> 15
  hash = Math.imul(hash, 0x846ca68b)
  hash ^= hash >>> 16

  return hash >>> 0
}

function hashGridPoint(seedHash: number, gridX: number, gridZ: number): number {
  return mixHash(
    seedHash ^
      (Math.imul(gridX | 0, 0x1f123bb5) >>> 0) ^
      (Math.imul(gridZ | 0, 0x5f356495) >>> 0)
  )
}

function getGradient(hash: number): readonly [number, number] {
  return GRADIENT_DIRECTIONS[hash & 7] ?? GRADIENT_DIRECTIONS[0]
}

function gradientDot(
  seedHash: number,
  gridX: number,
  gridZ: number,
  offsetX: number,
  offsetZ: number
): number {
  const [gradientX, gradientZ] = getGradient(
    hashGridPoint(seedHash, gridX, gridZ)
  )

  return gradientX * offsetX + gradientZ * offsetZ
}

export function hashSeed(seed: number | string): number {
  const input = String(seed)
  let hash = 2166136261

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

export function createTerrainGenerationSettings(
  options: TerrainGenerationOptions
): TerrainGenerationSettings {
  const seedHash = hashSeed(options.seed)

  return {
    baseHeight: options.baseHeight ?? DEFAULT_BASE_HEIGHT,
    continentalFrequency:
      options.continentalFrequency ?? DEFAULT_CONTINENTAL_FREQUENCY,
    detailAmplitude: options.detailAmplitude ?? DEFAULT_DETAIL_AMPLITUDE,
    detailFrequency: options.detailFrequency ?? DEFAULT_DETAIL_FREQUENCY,
    detailOffsetX: options.detailOffsetX ?? DEFAULT_DETAIL_OFFSET_X,
    detailOffsetZ: options.detailOffsetZ ?? DEFAULT_DETAIL_OFFSET_Z,
    detailSeedHash: mixHash(seedHash ^ DETAIL_SEED_SALT),
    heightAmplitude: options.heightAmplitude ?? DEFAULT_HEIGHT_AMPLITUDE,
    seedHash,
  }
}

export function sampleGradientNoise2D(
  sampleX: number,
  sampleZ: number,
  seedHash: number
): number {
  const minX = Math.floor(sampleX)
  const minZ = Math.floor(sampleZ)
  const offsetX = sampleX - minX
  const offsetZ = sampleZ - minZ
  const fadeX = fade(offsetX)
  const fadeZ = fade(offsetZ)

  const noise00 = gradientDot(seedHash, minX, minZ, offsetX, offsetZ)
  const noise10 = gradientDot(seedHash, minX + 1, minZ, offsetX - 1, offsetZ)
  const noise01 = gradientDot(seedHash, minX, minZ + 1, offsetX, offsetZ - 1)
  const noise11 = gradientDot(
    seedHash,
    minX + 1,
    minZ + 1,
    offsetX - 1,
    offsetZ - 1
  )

  return lerp(
    lerp(noise00, noise10, fadeX),
    lerp(noise01, noise11, fadeX),
    fadeZ
  )
}

export function getSurfaceHeightAt(
  worldX: number,
  worldZ: number,
  settings: TerrainGenerationSettings
): number {
  const continentalNoise = sampleGradientNoise2D(
    worldX * settings.continentalFrequency,
    worldZ * settings.continentalFrequency,
    settings.seedHash
  )
  const detailNoise = sampleGradientNoise2D(
    worldX * settings.detailFrequency + settings.detailOffsetX,
    worldZ * settings.detailFrequency + settings.detailOffsetZ,
    settings.detailSeedHash
  )

  return Math.floor(
    settings.baseHeight +
      continentalNoise * settings.heightAmplitude +
      detailNoise * settings.detailAmplitude
  )
}

export function getTerrainMaterialId(
  worldY: number,
  surfaceHeight: number
): number {
  if (worldY > surfaceHeight) {
    return 0
  }

  const depth = surfaceHeight - worldY

  if (depth === 0) {
    return 3
  }

  if (depth < 4) {
    return 2
  }

  return 1
}

export function fillChunkWithTerrain(
  chunk: Chunk,
  coords: ChunkCoordinates,
  settings: TerrainGenerationSettings
): Chunk {
  for (let z = 0; z < CHUNK_SIZE; z += 1) {
    for (let x = 0; x < CHUNK_SIZE; x += 1) {
      const worldX = coords.x * CHUNK_SIZE + x
      const worldZ = coords.z * CHUNK_SIZE + z
      const surfaceHeight = getSurfaceHeightAt(worldX, worldZ, settings)

      for (let y = 0; y < CHUNK_SIZE; y += 1) {
        const worldY = coords.y * CHUNK_SIZE + y
        const materialId = getTerrainMaterialId(worldY, surfaceHeight)

        if (materialId !== 0) {
          chunk.set(x, y, z, materialId)
        }
      }
    }
  }

  return chunk
}
