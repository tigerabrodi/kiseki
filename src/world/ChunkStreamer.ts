import { CHUNK_SIZE, Chunk } from '../voxel/chunk.ts'
import {
  chunkKey,
  type ChunkCoordinates,
  type WorldChunkEntry,
} from './World.ts'
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
  maxLoadsPerUpdate?: number
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

function distanceSquared(a: ChunkCoordinates, b: ChunkCoordinates): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z

  return dx * dx + dy * dy + dz * dz
}

function assertValidLoadBudget(value: number): void {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new RangeError(
      `maxLoadsPerUpdate must be a positive integer, got ${value}`
    )
  }
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
  private readonly maxLoadsPerUpdate: number
  private readonly pendingLoadCoords = new Map<string, ChunkCoordinates>()
  private readonly unloadExtents: ChunkStreamExtents

  constructor(options: ChunkStreamerOptions) {
    this.createChunk = options.createChunk
    this.loadExtents = normalizeChunkStreamExtents(options.loadRadius)
    this.maxLoadsPerUpdate =
      options.maxLoadsPerUpdate ?? Number.POSITIVE_INFINITY

    if (options.maxLoadsPerUpdate !== undefined) {
      assertValidLoadBudget(options.maxLoadsPerUpdate)
    }

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

          this.pendingLoadCoords.set(chunkKey(coords), coords)
        }
      }
    }

    for (const [key, coords] of this.pendingLoadCoords) {
      if (isChunkWithinExtents(coords, playerChunk, this.loadExtents)) {
        continue
      }

      this.pendingLoadCoords.delete(key)
    }

    for (const entry of this.world.entries()) {
      if (isChunkWithinExtents(entry.coords, playerChunk, this.unloadExtents)) {
        continue
      }

      this.world.deleteChunk(entry.coords)
      unloaded.push(entry)
    }

    const loadCandidates = [...this.pendingLoadCoords.values()]
      .filter((coords) =>
        isChunkWithinExtents(coords, playerChunk, this.loadExtents)
      )
      .sort(
        (a, b) =>
          distanceSquared(a, playerChunk) - distanceSquared(b, playerChunk)
      )

    for (const coords of loadCandidates.slice(0, this.maxLoadsPerUpdate)) {
      const key = chunkKey(coords)

      if (this.world.hasChunk(coords)) {
        this.pendingLoadCoords.delete(key)
        continue
      }

      const chunk = this.createChunk(coords)

      this.world.setChunk(coords, chunk)
      this.pendingLoadCoords.delete(key)
      loaded.push({
        chunk,
        coords,
      })
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

  getMaxRetainedChunkCount(): number {
    return (
      (this.unloadExtents.x * 2 + 1) *
      (this.unloadExtents.y * 2 + 1) *
      (this.unloadExtents.z * 2 + 1)
    )
  }
}
