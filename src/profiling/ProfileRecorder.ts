export type ProfileFrameSample = {
  chunkCount: number
  cpuTimeMs: number
  fps: number
  gpuMemoryBytes: number
  gpuTimeMs: number | null
  jsHeapBytes: number | null
  triangleCount: number
}

export type ProfileMetricSummary = {
  average: number
  max: number
  min: number
  samples: number
}

export type ProfileMemorySummary = {
  gpuBytes: ProfileMetricSummary
  jsHeapBytes: ProfileMetricSummary | null
}

export type ProfileMeshGenerationSummary = ProfileMetricSummary & {
  total: number
}

export type ProfileReport = {
  chunkCount: ProfileMetricSummary
  cpuTimeMs: ProfileMetricSummary
  durationSeconds: number
  fps: ProfileMetricSummary
  frameCount: number
  gpuTimeMs: ProfileMetricSummary | null
  memory: ProfileMemorySummary
  meshGenerationTimeMs: ProfileMeshGenerationSummary
  triangleCount: ProfileMetricSummary
}

export type ProfileSessionState = {
  elapsedSeconds: number
  isRecording: boolean
  lastReport: ProfileReport | null
}

class MetricAccumulator {
  private count = 0
  private max = Number.NEGATIVE_INFINITY
  private min = Number.POSITIVE_INFINITY
  private total = 0

  add(value: number): void {
    this.count += 1
    this.total += value
    this.min = Math.min(this.min, value)
    this.max = Math.max(this.max, value)
  }

  reset(): void {
    this.count = 0
    this.max = Number.NEGATIVE_INFINITY
    this.min = Number.POSITIVE_INFINITY
    this.total = 0
  }

  summary(): ProfileMetricSummary {
    if (this.count === 0) {
      return {
        average: 0,
        max: 0,
        min: 0,
        samples: 0,
      }
    }

    return {
      average: this.total / this.count,
      max: this.max,
      min: this.min,
      samples: this.count,
    }
  }

  totalValue(): number {
    return this.total
  }
}

export function formatProfileReport(report: ProfileReport): string {
  const lines = [
    'Kiseki Profile Checkpoint 1',
    `Duration: ${report.durationSeconds.toFixed(1)} s`,
    `Frames: ${report.frameCount}`,
    `FPS avg/min/max: ${formatMetric(report.fps)}`,
    `Chunks avg/min/max: ${formatMetric(report.chunkCount, 1)}`,
    `Triangles avg/min/max: ${formatMetric(report.triangleCount, 1)}`,
    `CPU ms avg/min/max: ${formatMetric(report.cpuTimeMs)}`,
    `GPU ms avg/min/max: ${
      report.gpuTimeMs === null ? 'Unavailable' : formatMetric(report.gpuTimeMs)
    }`,
    `Mesh ms avg/max/total: ${report.meshGenerationTimeMs.average.toFixed(2)} / ${report.meshGenerationTimeMs.max.toFixed(2)} / ${report.meshGenerationTimeMs.total.toFixed(2)}`,
    `GPU memory avg/max: ${formatBytes(report.memory.gpuBytes.average)} / ${formatBytes(report.memory.gpuBytes.max)}`,
    `JS heap avg/max: ${
      report.memory.jsHeapBytes === null
        ? 'Unavailable'
        : `${formatBytes(report.memory.jsHeapBytes.average)} / ${formatBytes(report.memory.jsHeapBytes.max)}`
    }`,
  ]

  return lines.join('\n')
}

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let unitIndex = 0
  let value = bytes

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatMetric(
  metric: ProfileMetricSummary,
  fractionDigits = 2
): string {
  return `${metric.average.toFixed(fractionDigits)} / ${metric.min.toFixed(
    fractionDigits
  )} / ${metric.max.toFixed(fractionDigits)}`
}

export class ProfileRecorder {
  private readonly chunkCount = new MetricAccumulator()
  private readonly cpuTimeMs = new MetricAccumulator()
  private readonly fps = new MetricAccumulator()
  private readonly gpuMemoryBytes = new MetricAccumulator()
  private readonly gpuTimeMs = new MetricAccumulator()
  private readonly jsHeapBytes = new MetricAccumulator()
  private readonly meshGenerationTimeMs = new MetricAccumulator()
  private readonly triangleCount = new MetricAccumulator()

  private isRecordingSession = false
  private lastReportValue: ProfileReport | null = null
  private sessionStartMs = 0

  getLastReport(): ProfileReport | null {
    return this.lastReportValue
  }

  getSessionState(nowMs: number): ProfileSessionState {
    return {
      elapsedSeconds: this.isRecordingSession
        ? Math.max(0, nowMs - this.sessionStartMs) / 1000
        : 0,
      isRecording: this.isRecordingSession,
      lastReport: this.lastReportValue,
    }
  }

  isRecording(): boolean {
    return this.isRecordingSession
  }

  recordFrame(sample: ProfileFrameSample): void {
    if (!this.isRecordingSession) {
      return
    }

    this.chunkCount.add(sample.chunkCount)
    this.cpuTimeMs.add(sample.cpuTimeMs)
    this.fps.add(sample.fps)
    this.gpuMemoryBytes.add(sample.gpuMemoryBytes)
    this.triangleCount.add(sample.triangleCount)

    if (sample.jsHeapBytes !== null) {
      this.jsHeapBytes.add(sample.jsHeapBytes)
    }
  }

  recordGpuTime(durationMs: number): void {
    if (!this.isRecordingSession) {
      return
    }

    this.gpuTimeMs.add(durationMs)
  }

  recordMeshGeneration(durationMs: number): void {
    if (!this.isRecordingSession) {
      return
    }

    this.meshGenerationTimeMs.add(durationMs)
  }

  start(nowMs: number): void {
    this.resetSession()
    this.isRecordingSession = true
    this.sessionStartMs = nowMs
  }

  stop(nowMs: number): ProfileReport | null {
    if (!this.isRecordingSession) {
      return this.lastReportValue
    }

    this.isRecordingSession = false

    const report: ProfileReport = {
      chunkCount: this.chunkCount.summary(),
      cpuTimeMs: this.cpuTimeMs.summary(),
      durationSeconds: Math.max(0, nowMs - this.sessionStartMs) / 1000,
      fps: this.fps.summary(),
      frameCount: this.fps.summary().samples,
      gpuTimeMs:
        this.gpuTimeMs.summary().samples === 0
          ? null
          : this.gpuTimeMs.summary(),
      memory: {
        gpuBytes: this.gpuMemoryBytes.summary(),
        jsHeapBytes:
          this.jsHeapBytes.summary().samples === 0
            ? null
            : this.jsHeapBytes.summary(),
      },
      meshGenerationTimeMs: {
        ...this.meshGenerationTimeMs.summary(),
        total: this.meshGenerationTimeMs.totalValue(),
      },
      triangleCount: this.triangleCount.summary(),
    }

    this.lastReportValue = report

    return report
  }

  private resetSession(): void {
    this.chunkCount.reset()
    this.cpuTimeMs.reset()
    this.fps.reset()
    this.gpuMemoryBytes.reset()
    this.gpuTimeMs.reset()
    this.jsHeapBytes.reset()
    this.meshGenerationTimeMs.reset()
    this.triangleCount.reset()
  }
}
