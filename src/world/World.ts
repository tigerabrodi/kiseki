import { CHUNK_SIZE, Chunk } from '../voxel/chunk.ts'
import type { ChunkNeighbors } from '../voxel/chunkNeighbors.ts'

export type ChunkCoordinates = {
  x: number
  y: number
  z: number
}

export type WorldChunkEntry = {
  chunk: Chunk
  coords: ChunkCoordinates
}

export function chunkKey(coords: ChunkCoordinates): string {
  return `${coords.x},${coords.y},${coords.z}`
}

export function chunkOrigin(coords: ChunkCoordinates): ChunkCoordinates {
  return {
    x: coords.x * CHUNK_SIZE,
    y: coords.y * CHUNK_SIZE,
    z: coords.z * CHUNK_SIZE,
  }
}

export class World {
  private readonly chunks = new Map<string, WorldChunkEntry>()

  setChunk(coords: ChunkCoordinates, chunk: Chunk): void {
    this.chunks.set(chunkKey(coords), {
      chunk,
      coords: { ...coords },
    })
  }

  getChunk(coords: ChunkCoordinates): Chunk | undefined {
    return this.chunks.get(chunkKey(coords))?.chunk
  }

  getChunkNeighbors(coords: ChunkCoordinates): ChunkNeighbors {
    return {
      nx: this.getChunk({ x: coords.x - 1, y: coords.y, z: coords.z }),
      px: this.getChunk({ x: coords.x + 1, y: coords.y, z: coords.z }),
      ny: this.getChunk({ x: coords.x, y: coords.y - 1, z: coords.z }),
      py: this.getChunk({ x: coords.x, y: coords.y + 1, z: coords.z }),
      nz: this.getChunk({ x: coords.x, y: coords.y, z: coords.z - 1 }),
      pz: this.getChunk({ x: coords.x, y: coords.y, z: coords.z + 1 }),
    }
  }

  entries(): Array<WorldChunkEntry> {
    return [...this.chunks.values()]
  }
}

export function createChunkGrid(
  radius: number,
  createChunk: (coords: ChunkCoordinates) => Chunk
): World {
  const world = new World()

  for (let z = -radius; z <= radius; z += 1) {
    for (let y = -radius; y <= radius; y += 1) {
      for (let x = -radius; x <= radius; x += 1) {
        const coords = { x, y, z }
        world.setChunk(coords, createChunk(coords))
      }
    }
  }

  return world
}
