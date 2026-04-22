import type { Chunk } from './chunk.ts'

export type ChunkNeighbors = {
  nx?: Chunk
  ny?: Chunk
  nz?: Chunk
  px?: Chunk
  py?: Chunk
  pz?: Chunk
}
