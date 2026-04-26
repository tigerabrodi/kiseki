import { describe, expect, it } from 'vitest'

import { Chunk } from '../voxel/chunk.ts'
import type { WorldChunkEntry } from '../world/World.ts'
import { GpuChunkBufferCache } from './GpuChunkBufferCache.ts'

type TestHandle = {
  byteLength: number
  label: string
}

function entry(x: number): WorldChunkEntry {
  return {
    chunk: new Chunk(),
    coords: { x, y: 0, z: 0 },
  }
}

describe('GpuChunkBufferCache', () => {
  it('creates, reuses, releases, and totals chunk handles by chunk key', () => {
    const destroyed: Array<string> = []
    const cache = new GpuChunkBufferCache<TestHandle>(
      (chunkEntry) => ({
        byteLength: 16,
        label: `${chunkEntry.coords.x}`,
      }),
      (handle) => destroyed.push(handle.label)
    )

    cache.sync({ loaded: [entry(1), entry(1), entry(2)], unloaded: [] })

    expect(cache.size()).toBe(2)
    expect(cache.totalBytes()).toBe(32)
    expect(cache.getBuffer({ x: 1, y: 0, z: 0 })?.label).toBe('1')

    cache.sync({ loaded: [], unloaded: [entry(1)] })

    expect(cache.size()).toBe(1)
    expect(destroyed).toEqual(['1'])

    cache.dispose()

    expect(cache.size()).toBe(0)
    expect(destroyed).toEqual(['1', '2'])
  })
})
