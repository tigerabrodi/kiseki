import { describe, expect, it } from 'vitest'

import { createDebugChunkStreamer } from './createDebugChunkStreamer.ts'

describe('createDebugChunkStreamer', () => {
  it('limits debug chunk streaming to one new chunk per update', () => {
    const chunkStreamer = createDebugChunkStreamer()
    const firstUpdate = chunkStreamer.update({ x: 0, y: 0, z: 0 })

    expect(firstUpdate.loaded).toHaveLength(1)
    expect(chunkStreamer.getPendingLoadCount()).toBeGreaterThan(0)
  })
})
