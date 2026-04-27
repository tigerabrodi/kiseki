import { describe, expect, it } from 'vitest'

import { buildGpuAllocationSnapshot } from '../gpu/buildGpuAllocationSnapshot.ts'
import { ProfileRecorder, formatProfileReport } from './ProfileRecorder.ts'

describe('ProfileRecorder', () => {
  it('aggregates frame and mesh session metrics into a checkpoint report', () => {
    const recorder = new ProfileRecorder()
    const startAllocation = buildGpuAllocationSnapshot({
      mesh: {
        activeByteLength: 4096,
        activeCount: 12,
        allocationCount: 24,
        availableCount: 88,
        bufferCount: 6,
        capacity: 100,
        highWaterCount: 12,
        releaseCount: 12,
        reservedByteLength: 65536,
      },
      voxel: {
        activeByteLength: 2048,
        activeCount: 12,
        allocationCount: 24,
        availableCount: 88,
        bufferCount: 1,
        capacity: 100,
        highWaterCount: 12,
        releaseCount: 12,
        reservedByteLength: 32768,
      },
    })
    const endAllocation = buildGpuAllocationSnapshot({
      mesh: {
        activeByteLength: 6144,
        activeCount: 16,
        allocationCount: 30,
        availableCount: 84,
        bufferCount: 6,
        capacity: 100,
        highWaterCount: 16,
        releaseCount: 14,
        reservedByteLength: 65536,
      },
      voxel: {
        activeByteLength: 3072,
        activeCount: 16,
        allocationCount: 30,
        availableCount: 84,
        bufferCount: 1,
        capacity: 100,
        highWaterCount: 16,
        releaseCount: 14,
        reservedByteLength: 32768,
      },
    })

    recorder.start(1000, startAllocation)
    recorder.recordFrame({
      chunkLocalPosition: { x: 1, y: 2, z: 3 },
      chunkCount: 27,
      cpuTimeMs: 2,
      frameTimeMs: 16,
      fps: 60,
      gpuMemoryBytes: 4096,
      gpuTimeMs: null,
      jsHeapBytes: 2048,
      nearestChunkBoundaryDistance: 1,
      pendingStreamLoadCount: 4,
      postRenderStreamCpuTimeMs: 0.5,
      preRenderCpuTimeMs: 1,
      previousPostRenderStreamCpuTimeMs: 0.25,
      previousPostRenderStreamedInChunkCount: 1,
      previousPostRenderStreamedOutChunkCount: 0,
      renderSubmitCpuTimeMs: 0.125,
      triangleCount: 20000,
    })
    recorder.recordGpuTime(1.5)
    recorder.recordIndirectDrawInfo({
      activeDrawCount: 12,
      commandCount: 100,
    })
    recorder.recordOcclusionInfo({
      activeSlotCount: 90,
      candidateVisibleChunkCount: 70,
    })
    recorder.recordTerrainGeneration(6, 32)
    recorder.recordSdfGeneration(3, 32)
    recorder.recordLightGeneration(4, 32)
    recorder.recordMeshGeneration(8, 32)
    recorder.recordFrame({
      chunkLocalPosition: { x: 30, y: 4, z: 5 },
      chunkCount: 36,
      cpuTimeMs: 4,
      frameTimeMs: 20,
      fps: 50,
      gpuMemoryBytes: 6144,
      gpuTimeMs: null,
      jsHeapBytes: 3072,
      nearestChunkBoundaryDistance: 2,
      pendingStreamLoadCount: 2,
      postRenderStreamCpuTimeMs: 0.75,
      preRenderCpuTimeMs: 2,
      previousPostRenderStreamCpuTimeMs: 0.5,
      previousPostRenderStreamedInChunkCount: 2,
      previousPostRenderStreamedOutChunkCount: 1,
      renderSubmitCpuTimeMs: 0.375,
      triangleCount: 26000,
    })
    recorder.recordGpuTime(2.5)
    recorder.recordIndirectDrawInfo({
      activeDrawCount: 16,
      commandCount: 100,
    })
    recorder.recordOcclusionInfo({
      activeSlotCount: 110,
      candidateVisibleChunkCount: 80,
    })

    const report = recorder.stop(3000, endAllocation)

    expect(report).not.toBeNull()
    expect(report).toMatchObject({
      durationSeconds: 2,
      frameCount: 2,
      fps: {
        average: 55,
        max: 60,
        min: 50,
        samples: 2,
      },
      frameTimeMs: {
        average: 18,
        max: 20,
        min: 16,
        samples: 2,
      },
      fixedStepCount: {
        average: 0,
        max: 0,
        min: 0,
        samples: 2,
      },
      unaccountedFrameTimeMs: {
        average: 15,
        max: 16,
        min: 14,
        samples: 2,
      },
      preRenderCpuTimeMs: {
        average: 1.5,
        max: 2,
        min: 1,
        samples: 2,
      },
      renderSubmitCpuTimeMs: {
        average: 0.25,
        max: 0.375,
        min: 0.125,
        samples: 2,
      },
      postRenderStreamCpuTimeMs: {
        average: 0.625,
        max: 0.75,
        min: 0.5,
        samples: 2,
      },
      previousPostRenderStreamCpuTimeMs: {
        average: 0.375,
        max: 0.5,
        min: 0.25,
        samples: 2,
      },
      pendingStreamLoadCount: {
        average: 3,
        max: 4,
        min: 2,
        samples: 2,
      },
      nearestChunkBoundaryDistance: {
        average: 1.5,
        max: 2,
        min: 1,
        samples: 2,
      },
      chunkCount: {
        average: 31.5,
        max: 36,
        min: 27,
        samples: 2,
      },
      triangleCount: {
        average: 23000,
        max: 26000,
        min: 20000,
        samples: 2,
      },
      cpuTimeMs: {
        average: 3,
        max: 4,
        min: 2,
        samples: 2,
      },
      gpuTimeMs: {
        average: 2,
        max: 2.5,
        min: 1.5,
        samples: 2,
      },
      indirectDraw: {
        activeDrawCount: {
          average: 14,
          max: 16,
          min: 12,
          samples: 2,
        },
        commandCount: {
          average: 100,
          max: 100,
          min: 100,
          samples: 2,
        },
        zeroedCommandCount: {
          average: 86,
          max: 88,
          min: 84,
          samples: 2,
        },
      },
      occlusion: {
        activeSlotCount: {
          average: 100,
          max: 110,
          min: 90,
          samples: 2,
        },
        candidateVisibleChunkCount: {
          average: 75,
          max: 80,
          min: 70,
          samples: 2,
        },
        culledSlotCount: {
          average: 25,
          max: 30,
          min: 20,
          samples: 2,
        },
      },
      allocation: {
        isGpuPoolStable: true,
        totalBufferCount: {
          delta: 0,
          end: 7,
          start: 7,
        },
        totalReservedByteLength: {
          delta: 0,
          end: 98304,
          start: 98304,
        },
      },
      meshGenerationTimeMs: {
        average: 8,
        max: 8,
        min: 8,
        samples: 1,
        total: 8,
      },
      meshGenerationChunkCount: {
        average: 32,
        max: 32,
        min: 32,
        samples: 1,
      },
      meshGenerationPerChunkMs: {
        average: 0.25,
        max: 0.25,
        min: 0.25,
        samples: 1,
      },
      sdfGenerationTimeMs: {
        average: 3,
        max: 3,
        min: 3,
        samples: 1,
        total: 3,
      },
      sdfGenerationChunkCount: {
        average: 32,
        max: 32,
        min: 32,
        samples: 1,
      },
      sdfGenerationPerChunkMs: {
        average: 0.09375,
        max: 0.09375,
        min: 0.09375,
        samples: 1,
      },
      lightGenerationTimeMs: {
        average: 4,
        max: 4,
        min: 4,
        samples: 1,
        total: 4,
      },
      lightGenerationChunkCount: {
        average: 32,
        max: 32,
        min: 32,
        samples: 1,
      },
      lightGenerationPerChunkMs: {
        average: 0.125,
        max: 0.125,
        min: 0.125,
        samples: 1,
      },
      terrainGenerationTimeMs: {
        average: 6,
        max: 6,
        min: 6,
        samples: 1,
        total: 6,
      },
      terrainGenerationChunkCount: {
        average: 32,
        max: 32,
        min: 32,
        samples: 1,
      },
      terrainGenerationPerChunkMs: {
        average: 0.1875,
        max: 0.1875,
        min: 0.1875,
        samples: 1,
      },
      memory: {
        gpuBytes: {
          average: 5120,
          max: 6144,
          min: 4096,
          samples: 2,
        },
        jsHeapBytes: {
          average: 2560,
          max: 3072,
          min: 2048,
          samples: 2,
        },
      },
    })
  })

  it('handles unsupported optional metrics cleanly', () => {
    const recorder = new ProfileRecorder()

    recorder.start(0)
    recorder.recordFrame({
      chunkCount: 27,
      cpuTimeMs: 3.4,
      frameTimeMs: 17.2,
      fps: 58,
      gpuMemoryBytes: 4096,
      gpuTimeMs: null,
      jsHeapBytes: null,
      triangleCount: 21634,
    })

    const report = recorder.stop(1500)

    expect(report?.gpuTimeMs).toBeNull()
    expect(report?.indirectDraw).toBeNull()
    expect(report?.nearestChunkBoundaryDistance).toBeNull()
    expect(report?.occlusion).toBeNull()
    expect(report?.pendingStreamLoadCount).toBeNull()
    expect(report?.slowFrames).toHaveLength(1)
    expect(report?.memory.jsHeapBytes).toBeNull()
    expect(report?.meshGenerationChunkCount.average).toBe(0)
    expect(report?.meshGenerationPerChunkMs.average).toBe(0)
    expect(report?.meshGenerationTimeMs.total).toBe(0)
    expect(report?.sdfGenerationChunkCount.average).toBe(0)
    expect(report?.sdfGenerationPerChunkMs.average).toBe(0)
    expect(report?.sdfGenerationTimeMs.total).toBe(0)
    expect(report?.lightGenerationChunkCount.average).toBe(0)
    expect(report?.lightGenerationPerChunkMs.average).toBe(0)
    expect(report?.lightGenerationTimeMs.total).toBe(0)
    expect(report?.terrainGenerationChunkCount.average).toBe(0)
    expect(report?.terrainGenerationPerChunkMs.average).toBe(0)
    expect(report?.terrainGenerationTimeMs.total).toBe(0)
  })

  it('formats a readable checkpoint report', () => {
    const recorder = new ProfileRecorder()
    const allocation = buildGpuAllocationSnapshot({
      mesh: {
        activeByteLength: 4096,
        activeCount: 27,
        allocationCount: 40,
        availableCount: 60,
        bufferCount: 6,
        capacity: 100,
        highWaterCount: 32,
        releaseCount: 13,
        reservedByteLength: 1024 * 1024 * 32,
      },
      voxel: {
        activeByteLength: 2048,
        activeCount: 27,
        allocationCount: 40,
        availableCount: 60,
        bufferCount: 1,
        capacity: 100,
        highWaterCount: 32,
        releaseCount: 13,
        reservedByteLength: 1024 * 1024 * 16,
      },
    })

    recorder.start(0, allocation)
    recorder.recordFrame({
      chunkCount: 27,
      cpuTimeMs: 3,
      frameTimeMs: 16.7,
      fps: 60,
      gpuMemoryBytes: 1024 * 1024 * 8,
      gpuTimeMs: null,
      jsHeapBytes: 1024 * 1024 * 24,
      triangleCount: 21634,
    })
    recorder.recordGpuTime(1.2)
    recorder.recordIndirectDrawInfo({
      activeDrawCount: 12,
      commandCount: 100,
    })
    recorder.recordOcclusionInfo({
      activeSlotCount: 94,
      candidateVisibleChunkCount: 69,
    })

    const report = recorder.stop(1000, allocation)

    expect(report).not.toBeNull()
    expect(formatProfileReport(report!)).toContain(
      'Kiseki Profile Checkpoint 6'
    )
    expect(formatProfileReport(report!)).toContain('FPS avg/min/max')
    expect(formatProfileReport(report!)).toContain('Frame ms avg/min/max')
    expect(formatProfileReport(report!)).toContain(
      'Unaccounted frame ms avg/min/max'
    )
    expect(formatProfileReport(report!)).toContain('Fixed steps avg/min/max')
    expect(formatProfileReport(report!)).toContain(
      'CPU phase ms pre/render/post-stream avg/max'
    )
    expect(formatProfileReport(report!)).toContain(
      'Previous post-stream CPU ms avg/max'
    )
    expect(formatProfileReport(report!)).toContain(
      'Stream pending loads avg/min/max'
    )
    expect(formatProfileReport(report!)).toContain(
      'Nearest chunk boundary dist avg/min/max'
    )
    expect(formatProfileReport(report!)).toContain('Worst frame 1')
    expect(formatProfileReport(report!)).toContain('CPU @60Hz budget avg/max')
    expect(formatProfileReport(report!)).toContain('Indirect draws avg/min/max')
    expect(formatProfileReport(report!)).toContain(
      'Indirect zeroed commands avg/min/max'
    )
    expect(formatProfileReport(report!)).toContain(
      'Indirect command slots avg/min/max'
    )
    expect(formatProfileReport(report!)).toContain(
      'Occlusion culled slots avg/min/max'
    )
    expect(formatProfileReport(report!)).toContain(
      'Terrain ms/chunk avg/min/max'
    )
    expect(formatProfileReport(report!)).toContain('SDF ms/chunk avg/min/max')
    expect(formatProfileReport(report!)).toContain('Light ms/chunk avg/min/max')
    expect(formatProfileReport(report!)).toContain('Mesh ms/chunk avg/min/max')
    expect(formatProfileReport(report!)).toContain(
      'GPU pool stable after startup: Yes'
    )
    expect(formatProfileReport(report!)).toContain(
      'GPU buffers start/end/delta'
    )
    expect(formatProfileReport(report!)).toContain('GPU memory avg/max')
  })

  it('keeps the slowest frames with streaming context', () => {
    const recorder = new ProfileRecorder()

    recorder.start(100)

    for (let frameIndex = 0; frameIndex < 7; frameIndex += 1) {
      recorder.recordFrame({
        chunkLocalPosition: { x: frameIndex, y: frameIndex + 1, z: 31 },
        chunkCount: 100 + frameIndex,
        cpuTimeMs: frameIndex,
        drawCalls: 10 + frameIndex,
        frameTimeMs: 10 + frameIndex,
        fixedStepCount: frameIndex,
        fps: 100 - frameIndex,
        gpuMemoryBytes: 1024,
        gpuTimeMs: frameIndex === 6 ? 4 : null,
        jsHeapBytes: 2048 + frameIndex,
        lightGeneratedChunkCount: frameIndex + 3,
        lightGenerationTimeMs: frameIndex + 0.3,
        meshGenerationTimeMs: frameIndex + 0.4,
        meshRebuiltChunkCount: frameIndex + 4,
        nearestChunkBoundaryDistance: frameIndex,
        pendingStreamLoadCount: 7 - frameIndex,
        playerChunk: { x: frameIndex, y: 1, z: 2 },
        position: { x: frameIndex * 16, y: 32, z: 48 },
        postRenderStreamCpuTimeMs: frameIndex + 0.7,
        preRenderCpuTimeMs: frameIndex + 0.5,
        previousPostRenderStreamCpuTimeMs: frameIndex + 0.6,
        previousPostRenderStreamedInChunkCount: frameIndex + 8,
        previousPostRenderStreamedOutChunkCount: frameIndex + 9,
        renderSubmitCpuTimeMs: frameIndex + 0.8,
        sdfGeneratedChunkCount: frameIndex + 2,
        sdfGenerationTimeMs: frameIndex + 0.2,
        streamedInChunkCount: frameIndex,
        streamedOutChunkCount: Math.max(0, frameIndex - 1),
        terrainGeneratedChunkCount: frameIndex + 1,
        terrainGenerationTimeMs: frameIndex + 0.1,
        timestampMs: 100 + frameIndex * 1000,
        triangleCount: 20000 + frameIndex,
        visibleChunkCount: 40 + frameIndex,
      })
    }

    const report = recorder.stop(8000)

    expect(report?.slowFrames).toHaveLength(5)
    expect(report?.slowFrames.map((frame) => frame.frameTimeMs)).toEqual([
      16, 15, 14, 13, 12,
    ])
    expect(report?.slowFrames[0]).toMatchObject({
      chunkLocalPosition: { x: 6, y: 7, z: 31 },
      drawCalls: 16,
      elapsedSeconds: 6,
      fixedStepCount: 6,
      gpuTimeMs: 4,
      lightGeneratedChunkCount: 9,
      meshRebuiltChunkCount: 10,
      nearestChunkBoundaryDistance: 6,
      pendingStreamLoadCount: 1,
      playerChunk: { x: 6, y: 1, z: 2 },
      position: { x: 96, y: 32, z: 48 },
      postRenderStreamCpuTimeMs: 6.7,
      preRenderCpuTimeMs: 6.5,
      previousPostRenderStreamCpuTimeMs: 6.6,
      previousPostRenderStreamedInChunkCount: 14,
      previousPostRenderStreamedOutChunkCount: 15,
      renderSubmitCpuTimeMs: 6.8,
      streamedInChunkCount: 6,
      streamedOutChunkCount: 5,
      unaccountedFrameTimeMs: 6,
      visibleChunkCount: 46,
    })
  })
})
