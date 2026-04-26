import { describe, expect, it, vi } from 'vitest'

import type { GpuChunkIndirectDrawCuller } from '../gpu/GpuChunkIndirectDrawCuller.ts'
import type { GpuChunkOcclusionCuller } from '../gpu/GpuChunkOcclusionCuller.ts'
import { ProfileRecorder } from '../profiling/ProfileRecorder.ts'
import { createGpuIndirectDrawProfileSampler } from './createGpuIndirectDrawProfileSampler.ts'

function createFakeCuller(
  readDrawInfo: () => Promise<{
    activeDrawCount: number
    commandCount: number
    words: Array<number>
  }>
): GpuChunkIndirectDrawCuller {
  return { readDrawInfo } as unknown as GpuChunkIndirectDrawCuller
}

function createFakeOcclusionCuller(
  readInfo: () => Promise<{
    activeSlotCount: number
    candidateVisibleChunkCount: number
  }>
): GpuChunkOcclusionCuller {
  return { readInfo } as unknown as GpuChunkOcclusionCuller
}

describe('createGpuIndirectDrawProfileSampler', () => {
  it('samples indirect draw info at the configured frame interval', async () => {
    const recorder = new ProfileRecorder()
    const readDrawInfo = vi.fn().mockResolvedValue({
      activeDrawCount: 3,
      commandCount: 10,
      words: [],
    })
    const sampler = createGpuIndirectDrawProfileSampler({
      getCuller: () => createFakeCuller(readDrawInfo),
      recorder,
      refreshEveryFrames: 2,
    })

    recorder.start(0)
    sampler.tick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(readDrawInfo).not.toHaveBeenCalled()

    sampler.tick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const report = recorder.stop(1000)

    expect(readDrawInfo).toHaveBeenCalledTimes(1)
    expect(report?.indirectDraw?.activeDrawCount.average).toBe(3)
    expect(report?.indirectDraw?.zeroedCommandCount.average).toBe(7)
  })

  it('flushes a final indirect draw sample before profile stop', async () => {
    const recorder = new ProfileRecorder()
    const readDrawInfo = vi.fn().mockResolvedValue({
      activeDrawCount: 4,
      commandCount: 12,
      words: [],
    })
    const sampler = createGpuIndirectDrawProfileSampler({
      getCuller: () => createFakeCuller(readDrawInfo),
      recorder,
    })

    recorder.start(0)
    await sampler.flush()
    const report = recorder.stop(1000)

    expect(readDrawInfo).toHaveBeenCalledTimes(1)
    expect(report?.indirectDraw?.activeDrawCount.average).toBe(4)
    expect(report?.indirectDraw?.zeroedCommandCount.average).toBe(8)
  })

  it('records occlusion info with indirect draw samples when available', async () => {
    const recorder = new ProfileRecorder()
    const readDrawInfo = vi.fn().mockResolvedValue({
      activeDrawCount: 4,
      commandCount: 12,
      words: [],
    })
    const readInfo = vi.fn().mockResolvedValue({
      activeSlotCount: 94,
      candidateVisibleChunkCount: 69,
    })
    const sampler = createGpuIndirectDrawProfileSampler({
      getCuller: () => createFakeCuller(readDrawInfo),
      getOcclusionCuller: () => createFakeOcclusionCuller(readInfo),
      recorder,
    })

    recorder.start(0)
    await sampler.flush()
    const report = recorder.stop(1000)

    expect(readInfo).toHaveBeenCalledTimes(1)
    expect(report?.occlusion?.activeSlotCount.average).toBe(94)
    expect(report?.occlusion?.candidateVisibleChunkCount.average).toBe(69)
    expect(report?.occlusion?.culledSlotCount.average).toBe(25)
  })
})
