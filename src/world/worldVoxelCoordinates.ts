import { CHUNK_SIZE, xyz2i } from '../voxel/chunk.ts'
import type { ChunkCoordinates } from './World.ts'

export type LocalVoxelCoordinates = {
  x: number
  y: number
  z: number
}

export type WorldVoxelCoordinates = {
  x: number
  y: number
  z: number
}

export type ChunkVoxelCoordinates = {
  chunkCoords: ChunkCoordinates
  localCoords: LocalVoxelCoordinates
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

export function worldVoxelToChunkVoxel(
  coords: WorldVoxelCoordinates
): ChunkVoxelCoordinates {
  return {
    chunkCoords: {
      x: Math.floor(coords.x / CHUNK_SIZE),
      y: Math.floor(coords.y / CHUNK_SIZE),
      z: Math.floor(coords.z / CHUNK_SIZE),
    },
    localCoords: {
      x: modulo(coords.x, CHUNK_SIZE),
      y: modulo(coords.y, CHUNK_SIZE),
      z: modulo(coords.z, CHUNK_SIZE),
    },
  }
}

export function localVoxelToWorldVoxel(
  chunkCoords: ChunkCoordinates,
  localCoords: LocalVoxelCoordinates
): WorldVoxelCoordinates {
  return {
    x: chunkCoords.x * CHUNK_SIZE + localCoords.x,
    y: chunkCoords.y * CHUNK_SIZE + localCoords.y,
    z: chunkCoords.z * CHUNK_SIZE + localCoords.z,
  }
}

export function getLocalVoxelIndex(localCoords: LocalVoxelCoordinates): number {
  return xyz2i(localCoords.x, localCoords.y, localCoords.z)
}

export function getAffectedChunkCoordsForLocalVoxel(
  chunkCoords: ChunkCoordinates,
  localCoords: LocalVoxelCoordinates
): Array<ChunkCoordinates> {
  const affected = [{ ...chunkCoords }] satisfies Array<ChunkCoordinates>

  if (localCoords.x === 0) {
    affected.push({
      x: chunkCoords.x - 1,
      y: chunkCoords.y,
      z: chunkCoords.z,
    })
  }

  if (localCoords.x === CHUNK_SIZE - 1) {
    affected.push({
      x: chunkCoords.x + 1,
      y: chunkCoords.y,
      z: chunkCoords.z,
    })
  }

  if (localCoords.y === 0) {
    affected.push({
      x: chunkCoords.x,
      y: chunkCoords.y - 1,
      z: chunkCoords.z,
    })
  }

  if (localCoords.y === CHUNK_SIZE - 1) {
    affected.push({
      x: chunkCoords.x,
      y: chunkCoords.y + 1,
      z: chunkCoords.z,
    })
  }

  if (localCoords.z === 0) {
    affected.push({
      x: chunkCoords.x,
      y: chunkCoords.y,
      z: chunkCoords.z - 1,
    })
  }

  if (localCoords.z === CHUNK_SIZE - 1) {
    affected.push({
      x: chunkCoords.x,
      y: chunkCoords.y,
      z: chunkCoords.z + 1,
    })
  }

  return affected
}

export function getChunkCoordsWithCardinalNeighbors(
  chunkCoords: ChunkCoordinates
): Array<ChunkCoordinates> {
  return [
    { ...chunkCoords },
    {
      x: chunkCoords.x - 1,
      y: chunkCoords.y,
      z: chunkCoords.z,
    },
    {
      x: chunkCoords.x + 1,
      y: chunkCoords.y,
      z: chunkCoords.z,
    },
    {
      x: chunkCoords.x,
      y: chunkCoords.y - 1,
      z: chunkCoords.z,
    },
    {
      x: chunkCoords.x,
      y: chunkCoords.y + 1,
      z: chunkCoords.z,
    },
    {
      x: chunkCoords.x,
      y: chunkCoords.y,
      z: chunkCoords.z - 1,
    },
    {
      x: chunkCoords.x,
      y: chunkCoords.y,
      z: chunkCoords.z + 1,
    },
  ]
}
