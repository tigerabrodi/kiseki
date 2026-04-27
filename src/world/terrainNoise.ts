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
const DEFAULT_MOISTURE_FREQUENCY = 0.014
const DEFAULT_PLATEAU_STRENGTH = 0.32
const DEFAULT_RIDGE_AMPLITUDE = 7
const DEFAULT_RIDGE_FREQUENCY = 0.028
const DEFAULT_VALLEY_DEPTH = 5
const DETAIL_SEED_SALT = 0x9e3779b9
const FEATURE_SEED_SALT = 0x27d4eb2d
const MOISTURE_SEED_SALT = 0x85ebca6b
const RIDGE_SEED_SALT = 0xc2b2ae35
const RIDGE_SHARPNESS = 3.1
const STONE_SLOPE_THRESHOLD = 2
const LOWLAND_SAND_OFFSET = -3
const WET_SAND_MOISTURE_THRESHOLD = 0.42
const DRY_SAND_MOISTURE_THRESHOLD = 0.21
const DRY_SAND_HEIGHT_OFFSET = 3
const SUBSURFACE_DEPTH = 4
const TERRACE_HEIGHT_STEP = 2

export const TREE_TRUNK_MATERIAL_ID = 6
export const TREE_LEAF_MATERIAL_ID = 7
export const BOULDER_MATERIAL_ID = 8

const FEATURE_CELL_SIZE = 24
const FEATURE_CELL_MARGIN = 4
const FEATURE_CELL_SPAN = FEATURE_CELL_SIZE - FEATURE_CELL_MARGIN * 2
const FEATURE_NEIGHBOR_RADIUS = 1
const TREE_SPAWN_THRESHOLD = 0.24
const TREE_MIN_MOISTURE = 0.3
const TREE_MAX_SLOPE = 1
const TREE_CANOPY_RADIUS = 3
const BOULDER_SPAWN_MIN = 0.24
const BOULDER_SPAWN_MAX = 0.36
const BOULDER_MAX_SLOPE = 1

export type TerrainGenerationOptions = {
  baseHeight?: number
  continentalFrequency?: number
  detailAmplitude?: number
  detailFrequency?: number
  detailOffsetX?: number
  detailOffsetZ?: number
  heightAmplitude?: number
  moistureFrequency?: number
  plateauStrength?: number
  ridgeAmplitude?: number
  ridgeFrequency?: number
  seed: number | string
  valleyDepth?: number
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
  moistureFrequency: number
  moistureSeedHash: number
  plateauStrength: number
  ridgeAmplitude: number
  ridgeFrequency: number
  ridgeSeedHash: number
  seedHash: number
  valleyDepth: number
}

export type TerrainSurfaceSample = {
  moisture: number
  slope: number
  surfaceHeight: number
}

function fade(value: number): number {
  return value * value * value * (value * (value * 6 - 15) + 10)
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
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

function hashFeatureCell(
  settings: TerrainGenerationSettings,
  cellX: number,
  cellZ: number,
  salt: number
): number {
  return hashGridPoint(
    mixHash(settings.seedHash ^ FEATURE_SEED_SALT ^ salt),
    cellX,
    cellZ
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
    moistureFrequency: options.moistureFrequency ?? DEFAULT_MOISTURE_FREQUENCY,
    moistureSeedHash: mixHash(seedHash ^ MOISTURE_SEED_SALT),
    plateauStrength: options.plateauStrength ?? DEFAULT_PLATEAU_STRENGTH,
    ridgeAmplitude: options.ridgeAmplitude ?? DEFAULT_RIDGE_AMPLITUDE,
    ridgeFrequency: options.ridgeFrequency ?? DEFAULT_RIDGE_FREQUENCY,
    ridgeSeedHash: mixHash(seedHash ^ RIDGE_SEED_SALT),
    seedHash,
    valleyDepth: options.valleyDepth ?? DEFAULT_VALLEY_DEPTH,
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

function sampleNormalizedNoise2D(
  worldX: number,
  worldZ: number,
  frequency: number,
  seedHash: number
): number {
  return clamp(
    0.5 +
      sampleGradientNoise2D(worldX * frequency, worldZ * frequency, seedHash),
    0,
    1
  )
}

function getSurfaceHeightFloatAt(
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
  const ridgeNoise = sampleGradientNoise2D(
    worldX * settings.ridgeFrequency,
    worldZ * settings.ridgeFrequency,
    settings.ridgeSeedHash
  )
  const ridge = clamp(1 - Math.abs(ridgeNoise) * RIDGE_SHARPNESS, 0, 1)
  const valley = clamp(-continentalNoise * 1.45, 0, 1)
  const rawHeight =
    settings.baseHeight +
    continentalNoise * settings.heightAmplitude +
    detailNoise * settings.detailAmplitude +
    ridge * settings.ridgeAmplitude -
    valley * settings.valleyDepth
  const terraceHeight =
    Math.round(rawHeight / TERRACE_HEIGHT_STEP) * TERRACE_HEIGHT_STEP

  return lerp(rawHeight, terraceHeight, settings.plateauStrength)
}

export function getSurfaceHeightAt(
  worldX: number,
  worldZ: number,
  settings: TerrainGenerationSettings
): number {
  return Math.floor(getSurfaceHeightFloatAt(worldX, worldZ, settings))
}

export function getMoistureAt(
  worldX: number,
  worldZ: number,
  settings: TerrainGenerationSettings
): number {
  return sampleNormalizedNoise2D(
    worldX,
    worldZ,
    settings.moistureFrequency,
    settings.moistureSeedHash
  )
}

export function getTerrainSlopeAt(
  worldX: number,
  worldZ: number,
  settings: TerrainGenerationSettings
): number {
  const surfaceHeight = getSurfaceHeightAt(worldX, worldZ, settings)
  const eastHeight = getSurfaceHeightAt(worldX + 1, worldZ, settings)
  const southHeight = getSurfaceHeightAt(worldX, worldZ + 1, settings)

  return Math.max(
    Math.abs(surfaceHeight - eastHeight),
    Math.abs(surfaceHeight - southHeight)
  )
}

export function getTerrainSurfaceSampleAt(
  worldX: number,
  worldZ: number,
  settings: TerrainGenerationSettings
): TerrainSurfaceSample {
  return {
    moisture: getMoistureAt(worldX, worldZ, settings),
    slope: getTerrainSlopeAt(worldX, worldZ, settings),
    surfaceHeight: getSurfaceHeightAt(worldX, worldZ, settings),
  }
}

function getTopTerrainMaterialId(
  surfaceSample: TerrainSurfaceSample,
  settings: TerrainGenerationSettings
): number {
  const isLowland =
    surfaceSample.surfaceHeight <= settings.baseHeight + LOWLAND_SAND_OFFSET
  const isDryLowGrass =
    surfaceSample.moisture <= DRY_SAND_MOISTURE_THRESHOLD &&
    surfaceSample.surfaceHeight <= settings.baseHeight + DRY_SAND_HEIGHT_OFFSET

  if (surfaceSample.slope >= STONE_SLOPE_THRESHOLD) {
    return 1
  }

  if (
    (isLowland && surfaceSample.moisture >= WET_SAND_MOISTURE_THRESHOLD) ||
    isDryLowGrass
  ) {
    return 4
  }

  return 3
}

function hashUnitFloat(hash: number): number {
  return (hash >>> 8) / 0x01000000
}

function getFeatureCellAnchor(
  cellX: number,
  cellZ: number,
  hash: number
): { x: number; z: number } {
  return {
    x:
      cellX * FEATURE_CELL_SIZE +
      FEATURE_CELL_MARGIN +
      (mixHash(hash ^ 0xa511e9b3) % FEATURE_CELL_SPAN),
    z:
      cellZ * FEATURE_CELL_SIZE +
      FEATURE_CELL_MARGIN +
      (mixHash(hash ^ 0x63d83595) % FEATURE_CELL_SPAN),
  }
}

function isTreeAnchorValid(
  anchorX: number,
  anchorZ: number,
  settings: TerrainGenerationSettings
): { isValid: boolean; surfaceSample: TerrainSurfaceSample } {
  const surfaceSample = getTerrainSurfaceSampleAt(anchorX, anchorZ, settings)

  return {
    isValid:
      getTopTerrainMaterialId(surfaceSample, settings) === 3 &&
      surfaceSample.moisture >= TREE_MIN_MOISTURE &&
      surfaceSample.slope <= TREE_MAX_SLOPE,
    surfaceSample,
  }
}

function getTreeFeatureMaterialId(
  worldX: number,
  worldY: number,
  worldZ: number,
  settings: TerrainGenerationSettings
): number {
  const centerCellX = Math.floor(worldX / FEATURE_CELL_SIZE)
  const centerCellZ = Math.floor(worldZ / FEATURE_CELL_SIZE)

  for (
    let cellZ = centerCellZ - FEATURE_NEIGHBOR_RADIUS;
    cellZ <= centerCellZ + FEATURE_NEIGHBOR_RADIUS;
    cellZ += 1
  ) {
    for (
      let cellX = centerCellX - FEATURE_NEIGHBOR_RADIUS;
      cellX <= centerCellX + FEATURE_NEIGHBOR_RADIUS;
      cellX += 1
    ) {
      const hash = hashFeatureCell(settings, cellX, cellZ, 0x7443a1d5)
      const spawnChance = hashUnitFloat(hash)

      if (spawnChance > TREE_SPAWN_THRESHOLD) {
        continue
      }

      const anchor = getFeatureCellAnchor(cellX, cellZ, hash)
      const { isValid, surfaceSample } = isTreeAnchorValid(
        anchor.x,
        anchor.z,
        settings
      )

      if (!isValid) {
        continue
      }

      const trunkHeight = 5 + (mixHash(hash ^ 0xb5297a4d) % 3)
      const dx = worldX - anchor.x
      const dz = worldZ - anchor.z
      const dy = worldY - surfaceSample.surfaceHeight

      if (dx === 0 && dz === 0 && dy >= 1 && dy <= trunkHeight) {
        return TREE_TRUNK_MATERIAL_ID
      }

      const canopyDy = worldY - (surfaceSample.surfaceHeight + trunkHeight)
      const horizontalDistance = Math.abs(dx) + Math.abs(dz)
      const isWithinCanopyBounds =
        Math.abs(dx) <= TREE_CANOPY_RADIUS &&
        Math.abs(dz) <= TREE_CANOPY_RADIUS &&
        canopyDy >= -2 &&
        canopyDy <= 2
      const isRoundedCanopy =
        horizontalDistance + Math.max(Math.abs(canopyDy) - 1, 0) <=
        TREE_CANOPY_RADIUS + 1

      if (isWithinCanopyBounds && isRoundedCanopy) {
        return TREE_LEAF_MATERIAL_ID
      }
    }
  }

  return 0
}

function getBoulderFeatureMaterialId(
  worldX: number,
  worldY: number,
  worldZ: number,
  settings: TerrainGenerationSettings
): number {
  const centerCellX = Math.floor(worldX / FEATURE_CELL_SIZE)
  const centerCellZ = Math.floor(worldZ / FEATURE_CELL_SIZE)

  for (
    let cellZ = centerCellZ - FEATURE_NEIGHBOR_RADIUS;
    cellZ <= centerCellZ + FEATURE_NEIGHBOR_RADIUS;
    cellZ += 1
  ) {
    for (
      let cellX = centerCellX - FEATURE_NEIGHBOR_RADIUS;
      cellX <= centerCellX + FEATURE_NEIGHBOR_RADIUS;
      cellX += 1
    ) {
      const hash = hashFeatureCell(settings, cellX, cellZ, 0x91e10da5)
      const spawnChance = hashUnitFloat(hash)

      if (spawnChance < BOULDER_SPAWN_MIN || spawnChance > BOULDER_SPAWN_MAX) {
        continue
      }

      const anchor = getFeatureCellAnchor(cellX, cellZ, hash)
      const surfaceSample = getTerrainSurfaceSampleAt(
        anchor.x,
        anchor.z,
        settings
      )

      if (surfaceSample.slope > BOULDER_MAX_SLOPE) {
        continue
      }

      const radiusX = 2 + (mixHash(hash ^ 0x68bc21eb) % 2)
      const radiusZ = 2 + (mixHash(hash ^ 0x02e5be93) % 2)
      const radiusY = 1 + (mixHash(hash ^ 0x9e3779b9) % 2)
      const dx = (worldX - anchor.x) / radiusX
      const dy = (worldY - surfaceSample.surfaceHeight) / radiusY
      const dz = (worldZ - anchor.z) / radiusZ
      const isAboveGround = worldY >= surfaceSample.surfaceHeight
      const isInsideBoulder = dx * dx + dy * dy + dz * dz <= 1.0

      if (isAboveGround && isInsideBoulder) {
        return BOULDER_MATERIAL_ID
      }
    }
  }

  return 0
}

export function getOutdoorFeatureMaterialId(
  worldX: number,
  worldY: number,
  worldZ: number,
  settings: TerrainGenerationSettings
): number {
  const treeMaterialId = getTreeFeatureMaterialId(
    worldX,
    worldY,
    worldZ,
    settings
  )

  if (treeMaterialId !== 0) {
    return treeMaterialId
  }

  return getBoulderFeatureMaterialId(worldX, worldY, worldZ, settings)
}

export function getTerrainMaterialId(
  worldY: number,
  surfaceSample: TerrainSurfaceSample,
  settings: TerrainGenerationSettings
): number {
  if (worldY > surfaceSample.surfaceHeight) {
    return 0
  }

  const depth = surfaceSample.surfaceHeight - worldY

  if (depth === 0) {
    return getTopTerrainMaterialId(surfaceSample, settings)
  }

  if (depth < SUBSURFACE_DEPTH) {
    if (getTopTerrainMaterialId(surfaceSample, settings) === 4) {
      return 4
    }

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
      const surfaceSample = getTerrainSurfaceSampleAt(worldX, worldZ, settings)
      const minFeatureY = surfaceSample.surfaceHeight
      const maxFeatureY = surfaceSample.surfaceHeight + 12

      for (let y = 0; y < CHUNK_SIZE; y += 1) {
        const worldY = coords.y * CHUNK_SIZE + y
        const featureMaterialId =
          worldY >= minFeatureY && worldY <= maxFeatureY
            ? getOutdoorFeatureMaterialId(worldX, worldY, worldZ, settings)
            : 0
        const materialId = getTerrainMaterialId(worldY, surfaceSample, settings)

        if (featureMaterialId !== 0) {
          chunk.set(x, y, z, featureMaterialId)
        } else if (materialId !== 0) {
          chunk.set(x, y, z, materialId)
        }
      }
    }
  }

  return chunk
}
