import { CHUNK_SIZE, Chunk } from '../voxel/chunk.ts'
import type { ChunkCoordinates, WorldChunkEntry } from './World.ts'
import { World } from './World.ts'

type WorldPosition = {
  x: number
  y: number
  z: number
}

export type ChunkStreamExtents = {
  x: number
  y: number
  z: number
}

type ChunkStreamerOptions = {
  createChunk: (coords: ChunkCoordinates) => Chunk
  loadRadius: ChunkStreamExtents | number
  unloadBuffer: ChunkStreamExtents | number
}

export type ChunkStreamUpdate = {
  didChange: boolean
  loaded: Array<WorldChunkEntry>
  playerChunk: ChunkCoordinates
  unloaded: Array<WorldChunkEntry>
}

function assertValidExtent(
  axis: keyof ChunkStreamExtents,
  value: number
): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(
      `${axis} chunk extent must be a non-negative integer, got ${value}`
    )
  }
}

function normalizeChunkStreamExtents(
  extents: ChunkStreamExtents | number
): ChunkStreamExtents {
  if (typeof extents === 'number') {
    assertValidExtent('x', extents)

    return {
      x: extents,
      y: extents,
      z: extents,
    }
  }

  assertValidExtent('x', extents.x)
  assertValidExtent('y', extents.y)
  assertValidExtent('z', extents.z)

  return {
    x: extents.x,
    y: extents.y,
    z: extents.z,
  }
}

function addChunkStreamExtents(
  a: ChunkStreamExtents,
  b: ChunkStreamExtents
): ChunkStreamExtents {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
    z: a.z + b.z,
  }
}

function isChunkWithinExtents(
  coords: ChunkCoordinates,
  center: ChunkCoordinates,
  extents: ChunkStreamExtents
): boolean {
  return (
    Math.abs(coords.x - center.x) <= extents.x &&
    Math.abs(coords.y - center.y) <= extents.y &&
    Math.abs(coords.z - center.z) <= extents.z
  )
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
  private readonly loadExtents: ChunkStreamExtents
  private readonly unloadExtents: ChunkStreamExtents

  constructor(options: ChunkStreamerOptions) {
    this.createChunk = options.createChunk
    this.loadExtents = normalizeChunkStreamExtents(options.loadRadius)
    this.unloadExtents = addChunkStreamExtents(
      this.loadExtents,
      normalizeChunkStreamExtents(options.unloadBuffer)
    )
  }

  update(playerChunk: ChunkCoordinates): ChunkStreamUpdate {
    const loaded: Array<WorldChunkEntry> = []
    const unloaded: Array<WorldChunkEntry> = []

    for (
      let z = playerChunk.z - this.loadExtents.z;
      z <= playerChunk.z + this.loadExtents.z;
      z += 1
    ) {
      for (
        let y = playerChunk.y - this.loadExtents.y;
        y <= playerChunk.y + this.loadExtents.y;
        y += 1
      ) {
        for (
          let x = playerChunk.x - this.loadExtents.x;
          x <= playerChunk.x + this.loadExtents.x;
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
      if (isChunkWithinExtents(entry.coords, playerChunk, this.unloadExtents)) {
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
