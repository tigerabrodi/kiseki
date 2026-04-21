import { Chunk } from '../voxel/chunk.ts'

export function createDebugChunk(): Chunk {
  const chunk = new Chunk()

  for (let x = 0; x < 12; x += 1) {
    for (let z = 0; z < 12; z += 1) {
      chunk.set(x, 0, z, 1)
    }
  }

  for (let x = 2; x < 10; x += 1) {
    for (let z = 2; z < 10; z += 1) {
      if ((x + z) % 3 !== 0) {
        chunk.set(x, 1, z, 2)
      }
    }
  }

  for (let step = 0; step < 6; step += 1) {
    for (let z = 1; z < 4; z += 1) {
      chunk.set(3 + step, step + 2, z, 3)
    }
  }

  for (let y = 1; y < 8; y += 1) {
    chunk.set(1, y, 10, 4)
    chunk.set(10, y, 1, 4)
  }

  for (let y = 1; y < 5; y += 1) {
    chunk.set(8, y, 8, 5)
    chunk.set(9, y, 8, 5)
    chunk.set(8, y, 9, 5)
  }

  return chunk
}
