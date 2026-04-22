import { CHUNK_SIZE, Chunk } from '../voxel/chunk.ts'
import type { ChunkCoordinates, WorldChunkEntry } from './World.ts'
import { World } from './World.ts'

type WorldPosition = {
  x: number
  y: number
  z: number
}

type ChunkStreamerOptions = {
  createChunk: (coords: ChunkCoordinates) => Chunk
  loadRadius: number
  unloadBuffer: number
}

export type ChunkStreamUpdate = {
  didChange: boolean
  loaded: Array<WorldChunkEntry>
  playerChunk: ChunkCoordinates
  unloaded: Array<WorldChunkEntry>
}

function chunkDistance(a: ChunkCoordinates, b: ChunkCoordinates): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z))
}

export function worldPositionToChunkCoordinates(
  position: WorldPosition
): ChunkCoordinates {
  return {
    x: Math.floor(position.x / CHUNK_SIZE),
    y: Math.floor(position.y / CHUNK_SIZE),
    z: Math.floor(position.z / CHUNK_SIZE),
  }
}

export class ChunkStreamer {
  readonly world = new World()

  private readonly createChunk: (coords: ChunkCoordinates) => Chunk
  private readonly loadRadius: number
  private readonly unloadRadius: number

  constructor(options: ChunkStreamerOptions) {
    this.createChunk = options.createChunk
    this.loadRadius = options.loadRadius
    this.unloadRadius = options.loadRadius + options.unloadBuffer
  }

  update(playerChunk: ChunkCoordinates): ChunkStreamUpdate {
    const loaded: Array<WorldChunkEntry> = []
    const unloaded: Array<WorldChunkEntry> = []

    for (
      let z = playerChunk.z - this.loadRadius;
      z <= playerChunk.z + this.loadRadius;
      z += 1
    ) {
      for (
        let y = playerChunk.y - this.loadRadius;
        y <= playerChunk.y + this.loadRadius;
        y += 1
      ) {
        for (
          let x = playerChunk.x - this.loadRadius;
          x <= playerChunk.x + this.loadRadius;
          x += 1
        ) {
          const coords = { x, y, z }

          if (this.world.hasChunk(coords)) {
            continue
          }

          const chunk = this.createChunk(coords)

          this.world.setChunk(coords, chunk)
          loaded.push({
            chunk,
            coords,
          })
        }
      }
    }

    for (const entry of this.world.entries()) {
      if (chunkDistance(entry.coords, playerChunk) <= this.unloadRadius) {
        continue
      }

      this.world.deleteChunk(entry.coords)
      unloaded.push(entry)
    }

    return {
      didChange: loaded.length > 0 || unloaded.length > 0,
      loaded,
      playerChunk: { ...playerChunk },
      unloaded,
    }
  }

  updateFromWorldPosition(position: WorldPosition): ChunkStreamUpdate {
    return this.update(worldPositionToChunkCoordinates(position))
  }
}
