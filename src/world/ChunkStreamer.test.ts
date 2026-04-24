import { describe, expect, it } from 'vitest'

import { Chunk } from '../voxel/chunk.ts'
import { chunkKey } from './World.ts'
import {
  ChunkStreamer,
  worldPositionToChunkCoordinates,
} from './ChunkStreamer.ts'

function sortKeys(keys: Array<string>): Array<string> {
  return [...keys].sort()
}

describe('ChunkStreamer', () => {
  it('maps world positions to chunk coordinates', () => {
    expect(
      worldPositionToChunkCoordinates({
        x: -1,
        y: 32,
        z: -33,
      })
    ).toEqual({
      x: -1,
      y: 1,
      z: -2,
    })
  })

  it('loads nearby chunks and unloads them with hysteresis as the player moves', () => {
    const streamer = new ChunkStreamer({
      createChunk: () => new Chunk(),
      loadRadius: 1,
      unloadBuffer: 1,
    })

    const initialUpdate = streamer.update({ x: 0, y: 0, z: 0 })
    const moveOneChunk = streamer.update({ x: 1, y: 0, z: 0 })
    const moveTwoChunks = streamer.update({ x: 2, y: 0, z: 0 })

    expect(initialUpdate.loaded).toHaveLength(27)
    expect(initialUpdate.unloaded).toHaveLength(0)
    expect(streamer.world.hasChunk({ x: 0, y: 0, z: 0 })).toBe(true)

    expect(moveOneChunk.loaded).toHaveLength(9)
    expect(moveOneChunk.unloaded).toHaveLength(0)
    expect(
      sortKeys(moveOneChunk.loaded.map((entry) => chunkKey(entry.coords)))
    ).toEqual(
      sortKeys([
        '2,-1,-1',
        '2,-1,0',
        '2,-1,1',
        '2,0,-1',
        '2,0,0',
        '2,0,1',
        '2,1,-1',
        '2,1,0',
        '2,1,1',
      ])
    )

    expect(moveTwoChunks.loaded).toHaveLength(9)
    expect(moveTwoChunks.unloaded).toHaveLength(9)
    expect(
      sortKeys(moveTwoChunks.unloaded.map((entry) => chunkKey(entry.coords)))
    ).toEqual(
      sortKeys([
        '-1,-1,-1',
        '-1,-1,0',
        '-1,-1,1',
        '-1,0,-1',
        '-1,0,0',
        '-1,0,1',
        '-1,1,-1',
        '-1,1,0',
        '-1,1,1',
      ])
    )

    expect(streamer.world.entries()).toHaveLength(36)
    expect(streamer.world.hasChunk({ x: -1, y: 0, z: 0 })).toBe(false)
    expect(streamer.world.hasChunk({ x: 3, y: 0, z: 0 })).toBe(true)
  })

  it('supports wider horizontal streaming extents for fly mode', () => {
    const streamer = new ChunkStreamer({
      createChunk: () => new Chunk(),
      loadRadius: { x: 2, y: 1, z: 2 },
      unloadBuffer: { x: 1, y: 1, z: 1 },
    })

    const initialUpdate = streamer.update({ x: 0, y: 0, z: 0 })
    const moveOneChunk = streamer.update({ x: 1, y: 0, z: 0 })
    const moveTwoChunks = streamer.update({ x: 2, y: 0, z: 0 })

    expect(initialUpdate.loaded).toHaveLength(75)
    expect(moveOneChunk.loaded).toHaveLength(15)
    expect(moveOneChunk.unloaded).toHaveLength(0)
    expect(moveTwoChunks.loaded).toHaveLength(15)
    expect(moveTwoChunks.unloaded).toHaveLength(15)
    expect(streamer.world.entries()).toHaveLength(90)
  })

  it('reports the max retained chunk count implied by load radius and hysteresis', () => {
    const streamer = new ChunkStreamer({
      createChunk: () => new Chunk(),
      loadRadius: { x: 2, y: 1, z: 2 },
      unloadBuffer: { x: 1, y: 1, z: 1 },
    })

    expect(streamer.getMaxRetainedChunkCount()).toBe(245)
  })
})
