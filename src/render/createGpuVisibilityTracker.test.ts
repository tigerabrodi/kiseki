import * as THREE from 'three/webgpu'
import { describe, expect, it, vi } from 'vitest'

import type { GpuChunkVisibilityCuller } from '../gpu/GpuChunkVisibilityCuller.ts'
import { createGpuVisibilityTracker } from './createGpuVisibilityTracker.ts'

function createFakeCuller(
  readVisibilityInfo = vi.fn().mockResolvedValue({
    chunkCount: 10,
    visibleChunkCount: 4,
    words: [],
  })
): GpuChunkVisibilityCuller {
  return {
    cull: vi.fn(),
    readVisibilityInfo,
  } as unknown as GpuChunkVisibilityCuller
}

describe('createGpuVisibilityTracker', () => {
  it('does not read GPU visibility info automatically when refresh is disabled', async () => {
    const readVisibilityInfo = vi.fn().mockResolvedValue({
      chunkCount: 10,
      visibleChunkCount: 4,
      words: [],
    })
    const tracker = createGpuVisibilityTracker({
      getCuller: () => createFakeCuller(readVisibilityInfo),
      onVisibilityInfoChange: vi.fn(),
      refreshEveryFrames: null,
    })

    tracker.cull(new THREE.PerspectiveCamera())
    tracker.cull(new THREE.PerspectiveCamera())
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(readVisibilityInfo).not.toHaveBeenCalled()
  })

  it('still reads GPU visibility info on explicit debug requests', async () => {
    const readVisibilityInfo = vi.fn().mockResolvedValue({
      chunkCount: 10,
      visibleChunkCount: 4,
      words: [],
    })
    const tracker = createGpuVisibilityTracker({
      getCuller: () => createFakeCuller(readVisibilityInfo),
      onVisibilityInfoChange: vi.fn(),
      refreshEveryFrames: null,
    })

    expect(await tracker.readInfo()).toMatchObject({
      visibleChunkCount: 4,
    })
    expect(readVisibilityInfo).toHaveBeenCalledTimes(1)
  })
})
