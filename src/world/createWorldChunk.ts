import { CHUNK_SIZE, Chunk } from '../voxel/chunk.ts'
import type { ChunkCoordinates } from './World.ts'

function materialFromCoords(coords: ChunkCoordinates): number {
  const index = (coords.x + 2 * coords.y + 3 * coords.z) % 5

  return ((index + 5) % 5) + 1
}

export function createWorldChunk(coords: ChunkCoordinates): Chunk {
  const chunk = new Chunk()
  const baseMaterial = materialFromCoords(coords)

  for (let x = 0; x < CHUNK_SIZE; x += 1) {
    for (let z = 0; z < CHUNK_SIZE; z += 1) {
      chunk.set(x, 0, z, baseMaterial)
    }
  }

  if (coords.y === 0) {
    const accentMaterial = (baseMaterial % 5) + 1

    for (let y = 1; y < 7; y += 1) {
      chunk.set(CHUNK_SIZE - 1, y, 6, accentMaterial)
      chunk.set(0, y, CHUNK_SIZE - 7, accentMaterial)
    }
  }

  return chunk
}
