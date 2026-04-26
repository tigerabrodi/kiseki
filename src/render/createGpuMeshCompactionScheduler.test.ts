import { afterEach, describe, expect, it, vi } from 'vitest'

import { createGpuMeshCompactionScheduler } from './createGpuMeshCompactionScheduler.ts'

describe('createGpuMeshCompactionScheduler', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces repeated compaction requests', async () => {
    vi.useFakeTimers()

    const compact = vi.fn(() => Promise.resolve())
    const onAfterCompaction = vi.fn()
    const scheduler = createGpuMeshCompactionScheduler({
      delayMs: 100,
      getMeshCache: () =>
        ({
          handles: () => ['mesh-handle'],
        }) as never,
      getMeshSlab: () =>
        ({
          compact,
        }) as never,
      onAfterCompaction,
    })

    scheduler.schedule()
    scheduler.schedule()
    await vi.advanceTimersByTimeAsync(99)

    expect(compact).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    expect(compact).toHaveBeenCalledTimes(1)
    expect(compact).toHaveBeenCalledWith(['mesh-handle'])
    expect(onAfterCompaction).toHaveBeenCalledTimes(1)
  })
})
