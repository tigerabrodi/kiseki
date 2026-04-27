import { describe, expect, it } from 'vitest'

import { Chunk } from '../voxel/chunk.ts'
import { DeferredChunkRemeshQueue } from './deferredChunkRemeshQueue.ts'

describe('DeferredChunkRemeshQueue', () => {
  it('queues loaded chunk neighbors without queuing the changed chunk itself', () => {
    const queue = new DeferredChunkRemeshQueue()
    const coords = { x: 0, y: 0, z: 0 }

    queue.queueNeighbors(
      {
        loaded: [{ chunk: new Chunk(), coords }],
        unloaded: [],
      },
      (candidate) =>
        candidate.y === 0 &&
        candidate.z === 0 &&
        candidate.x >= -1 &&
        candidate.x <= 1
    )

    expect(queue.size()).toBe(2)
    expect(queue.take(1)).toHaveLength(1)
    expect(queue.size()).toBe(1)
  })
})
