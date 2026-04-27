import {
  type ChunkStreamUpdate,
  worldPositionToChunkCoordinates,
} from '../world/ChunkStreamer.ts'

export function createEmptyChunkStreamUpdate(position: {
  x: number
  y: number
  z: number
}): ChunkStreamUpdate {
  return {
    didChange: false,
    loaded: [],
    playerChunk: worldPositionToChunkCoordinates(position),
    unloaded: [],
  }
}
