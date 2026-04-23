import { describe, expect, it } from 'vitest'

import { ProfileRecorder, formatProfileReport } from './ProfileRecorder.ts'

describe('ProfileRecorder', () => {
  it('aggregates frame and mesh session metrics into a baseline report', () => {
    const recorder = new ProfileRecorder()

    recorder.start(1000)
    recorder.recordFrame({
      chunkCount: 27,
      cpuTimeMs: 2,
      fps: 60,
      gpuMemoryBytes: 4096,
      gpuTimeMs: null,
      jsHeapBytes: 2048,
      triangleCount: 20000,
    })
    recorder.recordGpuTime(1.5)
    recorder.recordMeshGeneration(8)
    recorder.recordFrame({
      chunkCount: 36,
      cpuTimeMs: 4,
      fps: 50,
      gpuMemoryBytes: 6144,
      gpuTimeMs: null,
      jsHeapBytes: 3072,
      triangleCount: 26000,
    })
    recorder.recordGpuTime(2.5)

    const report = recorder.stop(3000)

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
      meshGenerationTimeMs: {
        average: 8,
        max: 8,
        min: 8,
        samples: 1,
        total: 8,
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
      fps: 58,
      gpuMemoryBytes: 4096,
      gpuTimeMs: null,
      jsHeapBytes: null,
      triangleCount: 21634,
    })

    const report = recorder.stop(1500)

    expect(report?.gpuTimeMs).toBeNull()
    expect(report?.memory.jsHeapBytes).toBeNull()
    expect(report?.meshGenerationTimeMs.total).toBe(0)
  })

  it('formats a readable checkpoint report', () => {
    const recorder = new ProfileRecorder()

    recorder.start(0)
    recorder.recordFrame({
      chunkCount: 27,
      cpuTimeMs: 3,
      fps: 60,
      gpuMemoryBytes: 1024 * 1024 * 8,
      gpuTimeMs: null,
      jsHeapBytes: 1024 * 1024 * 24,
      triangleCount: 21634,
    })
    recorder.recordGpuTime(1.2)

    const report = recorder.stop(1000)

    expect(report).not.toBeNull()
    expect(formatProfileReport(report!)).toContain(
      'Kiseki Profile Checkpoint 1'
    )
    expect(formatProfileReport(report!)).toContain('FPS avg/min/max')
    expect(formatProfileReport(report!)).toContain('GPU memory avg/max')
  })
})
