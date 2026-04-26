import { Chunk } from '../voxel/chunk.ts'
import { ChunkStreamer } from '../world/ChunkStreamer.ts'

const DEBUG_CHUNK_LOAD_RADIUS = { x: 4, y: 1, z: 4 } as const
const DEBUG_CHUNK_UNLOAD_BUFFER = { x: 1, y: 1, z: 1 } as const
const DEBUG_CHUNK_LOADS_PER_FRAME = 1

export function createDebugChunkStreamer(): ChunkStreamer {
  return new ChunkStreamer({
    createChunk: () => new Chunk(),
    loadRadius: DEBUG_CHUNK_LOAD_RADIUS,
    maxLoadsPerUpdate: DEBUG_CHUNK_LOADS_PER_FRAME,
    unloadBuffer: DEBUG_CHUNK_UNLOAD_BUFFER,
  })
}
