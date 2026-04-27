import type { ChunkStreamUpdate } from '../world/ChunkStreamer.ts'
import { chunkKey, type ChunkCoordinates } from '../world/World.ts'
import { getChunkCoordsWithCardinalNeighbors } from '../world/worldVoxelCoordinates.ts'

export class DeferredChunkRemeshQueue {
  private readonly coordsByKey = new Map<string, ChunkCoordinates>()

  queueNeighbors(
    update: Pick<ChunkStreamUpdate, 'loaded' | 'unloaded'>,
    worldHasChunk: (coords: ChunkCoordinates) => boolean
  ): void {
    const changedKeys = new Set(
      [...update.loaded, ...update.unloaded].map((entry) =>
        chunkKey(entry.coords)
      )
    )

    for (const entry of [...update.loaded, ...update.unloaded]) {
      for (const coords of getChunkCoordsWithCardinalNeighbors(entry.coords)) {
        const key = chunkKey(coords)

        if (
          changedKeys.has(key) ||
          this.coordsByKey.has(key) ||
          !worldHasChunk(coords)
        ) {
          continue
        }

        this.coordsByKey.set(key, coords)
      }
    }
  }

  size(): number {
    return this.coordsByKey.size
  }

  take(maxCount: number): Array<ChunkCoordinates> {
    const coords: Array<ChunkCoordinates> = []

    for (const [key, value] of this.coordsByKey) {
      coords.push(value)
      this.coordsByKey.delete(key)

      if (coords.length >= maxCount) {
        break
      }
    }

    return coords
  }
}
