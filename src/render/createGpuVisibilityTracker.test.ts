import * as THREE from 'three/webgpu'
import { describe, expect, it, vi } from 'vitest'

import type {
  GpuChunkVisibilityCuller,
  GpuChunkVisibilityCullOptions,
} from '../gpu/GpuChunkVisibilityCuller.ts'
import { createGpuVisibilityTracker } from './createGpuVisibilityTracker.ts'

type FakeVisibilityCull = (
  camera: THREE.Camera,
  options?: GpuChunkVisibilityCullOptions
) => void

function createFakeCuller(
  readVisibilityInfo = vi.fn().mockResolvedValue({
    chunkCount: 10,
    visibleChunkCount: 4,
    words: [],
  }),
  cull: FakeVisibilityCull = vi.fn()
): GpuChunkVisibilityCuller {
  return {
    cull,
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

  it('passes ordered GPU work into the visibility culler', () => {
    let passedOptions: GpuChunkVisibilityCullOptions | undefined
    const cull = vi.fn<FakeVisibilityCull>((_camera, options) => {
      passedOptions = options
    })
    const encodeAfterCull = vi.fn()
    const camera = new THREE.PerspectiveCamera()
    const tracker = createGpuVisibilityTracker({
      encodeAfterCull,
      getCuller: () => createFakeCuller(undefined, cull),
      onVisibilityInfoChange: vi.fn(),
      refreshEveryFrames: null,
    })

    tracker.cull(camera)

    const encoder = {} as GPUCommandEncoder

    passedOptions?.encodeAfterCull?.(encoder)

    expect(passedOptions?.encodeAfterCull).toBe(encodeAfterCull)
    expect(encodeAfterCull).toHaveBeenCalledWith(encoder)
  })
})
