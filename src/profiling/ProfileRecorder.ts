import type { GpuAllocationSnapshot } from '../gpu/buildGpuAllocationSnapshot.ts'

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

export type ProfileMetricDelta = {
  delta: number
  end: number
  start: number
}

export type ProfileAllocationPoolSummary = {
  bufferCount: ProfileMetricDelta
  highWaterCount: number
  reservedByteLength: ProfileMetricDelta
  slotAllocationCount: number
  slotReleaseCount: number
}

export type ProfileAllocationSummary = {
  isGpuPoolStable: boolean
  mesh: ProfileAllocationPoolSummary | null
  totalBufferCount: ProfileMetricDelta
  totalReservedByteLength: ProfileMetricDelta
  voxel: ProfileAllocationPoolSummary | null
}

export type ProfileMemorySummary = {
  gpuBytes: ProfileMetricSummary
  jsHeapBytes: ProfileMetricSummary | null
}

export type ProfileIndirectDrawSummary = {
  activeDrawCount: ProfileMetricSummary
  commandCount: ProfileMetricSummary
  zeroedCommandCount: ProfileMetricSummary
}

export type ProfileOcclusionSummary = {
  activeSlotCount: ProfileMetricSummary
  candidateVisibleChunkCount: ProfileMetricSummary
  culledSlotCount: ProfileMetricSummary
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
  indirectDraw: ProfileIndirectDrawSummary | null
  occlusion: ProfileOcclusionSummary | null
  allocation: ProfileAllocationSummary | null
  memory: ProfileMemorySummary
  meshGenerationChunkCount: ProfileMetricSummary
  meshGenerationPerChunkMs: ProfileMetricSummary
  meshGenerationTimeMs: ProfileMeshGenerationSummary
  terrainGenerationChunkCount: ProfileMetricSummary
  terrainGenerationPerChunkMs: ProfileMetricSummary
  terrainGenerationTimeMs: ProfileMeshGenerationSummary
  triangleCount: ProfileMetricSummary
}

export type ProfileSessionState = {
  elapsedSeconds: number
  isRecording: boolean
  lastReport: ProfileReport | null
}

class MetricAccumulator {
  private count = 0
  private firstValueSeen: number | null = null
  private lastValueSeen: number | null = null
  private max = Number.NEGATIVE_INFINITY
  private min = Number.POSITIVE_INFINITY
  private total = 0

  add(value: number): void {
    if (this.count === 0) {
      this.firstValueSeen = value
    }

    this.count += 1
    this.lastValueSeen = value
    this.total += value
    this.min = Math.min(this.min, value)
    this.max = Math.max(this.max, value)
  }

  firstValue(): number {
    return this.firstValueSeen ?? 0
  }

  lastValue(): number {
    return this.lastValueSeen ?? 0
  }

  reset(): void {
    this.count = 0
    this.firstValueSeen = null
    this.lastValueSeen = null
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

function createMetricDelta(start: number, end: number): ProfileMetricDelta {
  return {
    delta: end - start,
    end,
    start,
  }
}

function buildAllocationPoolSummary(
  start: GpuAllocationSnapshot['mesh'],
  end: GpuAllocationSnapshot['mesh']
): ProfileAllocationPoolSummary | null {
  if (start === null || end === null) {
    return null
  }

  return {
    bufferCount: createMetricDelta(start.bufferCount, end.bufferCount),
    highWaterCount: end.highWaterCount,
    reservedByteLength: createMetricDelta(
      start.reservedByteLength,
      end.reservedByteLength
    ),
    slotAllocationCount: end.allocationCount - start.allocationCount,
    slotReleaseCount: end.releaseCount - start.releaseCount,
  }
}

function buildAllocationSummary(
  start: GpuAllocationSnapshot | null,
  end: GpuAllocationSnapshot | null
): ProfileAllocationSummary | null {
  if (start === null || end === null) {
    return null
  }

  const totalBufferCount = createMetricDelta(
    start.totalBufferCount,
    end.totalBufferCount
  )
  const totalReservedByteLength = createMetricDelta(
    start.totalReservedByteLength,
    end.totalReservedByteLength
  )

  return {
    isGpuPoolStable:
      totalBufferCount.delta === 0 && totalReservedByteLength.delta === 0,
    mesh: buildAllocationPoolSummary(start.mesh, end.mesh),
    totalBufferCount,
    totalReservedByteLength,
    voxel: buildAllocationPoolSummary(start.voxel, end.voxel),
  }
}

export function formatProfileReport(report: ProfileReport): string {
  let gpuPoolStabilityLabel = 'Unavailable'

  if (report.allocation !== null) {
    gpuPoolStabilityLabel = report.allocation.isGpuPoolStable ? 'Yes' : 'No'
  }

  const lines = [
    'Kiseki Profile Checkpoint 6',
    `Duration: ${report.durationSeconds.toFixed(1)} s`,
    `Frames: ${report.frameCount}`,
    `FPS avg/min/max: ${formatMetric(report.fps)}`,
    `Chunks avg/min/max: ${formatMetric(report.chunkCount, 1)}`,
    `Triangles avg/min/max: ${formatMetric(report.triangleCount, 1)}`,
    `CPU ms avg/min/max: ${formatMetric(report.cpuTimeMs)}`,
    `CPU @60Hz budget avg/max: ${formatFrameBudgetUsage(report.cpuTimeMs)}`,
    `GPU ms avg/min/max: ${
      report.gpuTimeMs === null ? 'Unavailable' : formatMetric(report.gpuTimeMs)
    }`,
    `Indirect draws avg/min/max: ${
      report.indirectDraw === null
        ? 'Unavailable'
        : formatMetric(report.indirectDraw.activeDrawCount, 1)
    }`,
    `Indirect zeroed commands avg/min/max: ${
      report.indirectDraw === null
        ? 'Unavailable'
        : formatMetric(report.indirectDraw.zeroedCommandCount, 1)
    }`,
    `Indirect command slots avg/min/max: ${
      report.indirectDraw === null
        ? 'Unavailable'
        : formatMetric(report.indirectDraw.commandCount, 1)
    }`,
    `Occlusion active slots avg/min/max: ${
      report.occlusion === null
        ? 'Unavailable'
        : formatMetric(report.occlusion.activeSlotCount, 1)
    }`,
    `Occlusion candidates avg/min/max: ${
      report.occlusion === null
        ? 'Unavailable'
        : formatMetric(report.occlusion.candidateVisibleChunkCount, 1)
    }`,
    `Occlusion culled slots avg/min/max: ${
      report.occlusion === null
        ? 'Unavailable'
        : formatMetric(report.occlusion.culledSlotCount, 1)
    }`,
    `Terrain dispatches: ${report.terrainGenerationTimeMs.samples}`,
    `Terrain chunks avg/min/max: ${formatMetric(report.terrainGenerationChunkCount, 1)}`,
    `Terrain ms avg/max/total: ${report.terrainGenerationTimeMs.average.toFixed(2)} / ${report.terrainGenerationTimeMs.max.toFixed(2)} / ${report.terrainGenerationTimeMs.total.toFixed(2)}`,
    `Terrain ms/chunk avg/min/max: ${formatMetric(report.terrainGenerationPerChunkMs)}`,
    `Mesh rebuilds: ${report.meshGenerationTimeMs.samples}`,
    `Mesh chunks avg/min/max: ${formatMetric(report.meshGenerationChunkCount, 1)}`,
    `Mesh ms avg/max/total: ${report.meshGenerationTimeMs.average.toFixed(2)} / ${report.meshGenerationTimeMs.max.toFixed(2)} / ${report.meshGenerationTimeMs.total.toFixed(2)}`,
    `Mesh ms/chunk avg/min/max: ${formatMetric(report.meshGenerationPerChunkMs)}`,
    `GPU memory avg/max: ${formatBytes(report.memory.gpuBytes.average)} / ${formatBytes(report.memory.gpuBytes.max)}`,
    `GPU pool stable after startup: ${gpuPoolStabilityLabel}`,
    `GPU buffers start/end/delta: ${
      report.allocation === null
        ? 'Unavailable'
        : formatCountDelta(report.allocation.totalBufferCount)
    }`,
    `GPU reserved start/end/delta: ${
      report.allocation === null
        ? 'Unavailable'
        : formatByteDelta(report.allocation.totalReservedByteLength)
    }`,
    `Voxel slot ops alloc/free/high-water: ${
      report.allocation?.voxel === null || report.allocation === null
        ? 'Unavailable'
        : `${report.allocation.voxel.slotAllocationCount} / ${report.allocation.voxel.slotReleaseCount} / ${report.allocation.voxel.highWaterCount}`
    }`,
    `Mesh slot ops alloc/free/high-water: ${
      report.allocation?.mesh === null || report.allocation === null
        ? 'Unavailable'
        : `${report.allocation.mesh.slotAllocationCount} / ${report.allocation.mesh.slotReleaseCount} / ${report.allocation.mesh.highWaterCount}`
    }`,
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

function formatCountDelta(metric: ProfileMetricDelta): string {
  return `${metric.start} / ${metric.end} / ${formatSignedNumber(metric.delta)}`
}

function formatByteDelta(metric: ProfileMetricDelta): string {
  return `${formatBytes(metric.start)} / ${formatBytes(metric.end)} / ${formatSignedBytes(metric.delta)}`
}

function formatFrameBudgetUsage(metric: ProfileMetricSummary): string {
  const frameBudgetMs = 1000 / 60

  return `${((metric.average / frameBudgetMs) * 100).toFixed(1)}% / ${(
    (metric.max / frameBudgetMs) *
    100
  ).toFixed(1)}%`
}

function formatSignedBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B'
  }

  return `${bytes > 0 ? '+' : '-'}${formatBytes(Math.abs(bytes))}`
}

function formatSignedNumber(value: number): string {
  if (value === 0) {
    return '0'
  }

  return `${value > 0 ? '+' : ''}${value}`
}

export class ProfileRecorder {
  private readonly chunkCount = new MetricAccumulator()
  private readonly cpuTimeMs = new MetricAccumulator()
  private readonly fps = new MetricAccumulator()
  private readonly gpuMemoryBytes = new MetricAccumulator()
  private readonly gpuTimeMs = new MetricAccumulator()
  private readonly indirectActiveDrawCount = new MetricAccumulator()
  private readonly indirectCommandCount = new MetricAccumulator()
  private readonly indirectZeroedCommandCount = new MetricAccumulator()
  private readonly jsHeapBytes = new MetricAccumulator()
  private readonly meshGenerationChunkCount = new MetricAccumulator()
  private readonly meshGenerationPerChunkMs = new MetricAccumulator()
  private readonly meshGenerationTimeMs = new MetricAccumulator()
  private readonly occlusionActiveSlotCount = new MetricAccumulator()
  private readonly occlusionCandidateVisibleChunkCount = new MetricAccumulator()
  private readonly occlusionCulledSlotCount = new MetricAccumulator()
  private readonly terrainGenerationChunkCount = new MetricAccumulator()
  private readonly terrainGenerationPerChunkMs = new MetricAccumulator()
  private readonly terrainGenerationTimeMs = new MetricAccumulator()
  private readonly triangleCount = new MetricAccumulator()

  private isRecordingSession = false
  private lastReportValue: ProfileReport | null = null
  private sessionStartGpuAllocationSnapshot: GpuAllocationSnapshot | null = null
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

  recordIndirectDrawInfo(sample: {
    activeDrawCount: number
    commandCount: number
  }): void {
    if (!this.isRecordingSession) {
      return
    }

    this.indirectActiveDrawCount.add(sample.activeDrawCount)
    this.indirectCommandCount.add(sample.commandCount)
    this.indirectZeroedCommandCount.add(
      Math.max(0, sample.commandCount - sample.activeDrawCount)
    )
  }

  recordOcclusionInfo(sample: {
    activeSlotCount: number
    candidateVisibleChunkCount: number
  }): void {
    if (!this.isRecordingSession) {
      return
    }

    this.occlusionActiveSlotCount.add(sample.activeSlotCount)
    this.occlusionCandidateVisibleChunkCount.add(
      sample.candidateVisibleChunkCount
    )
    this.occlusionCulledSlotCount.add(
      Math.max(0, sample.activeSlotCount - sample.candidateVisibleChunkCount)
    )
  }

  recordMeshGeneration(durationMs: number, chunkCount: number): void {
    if (!this.isRecordingSession) {
      return
    }

    this.meshGenerationTimeMs.add(durationMs)

    if (chunkCount > 0) {
      this.meshGenerationChunkCount.add(chunkCount)
      this.meshGenerationPerChunkMs.add(durationMs / chunkCount)
    }
  }

  recordTerrainGeneration(durationMs: number, chunkCount: number): void {
    if (!this.isRecordingSession) {
      return
    }

    this.terrainGenerationTimeMs.add(durationMs)

    if (chunkCount > 0) {
      this.terrainGenerationChunkCount.add(chunkCount)
      this.terrainGenerationPerChunkMs.add(durationMs / chunkCount)
    }
  }

  start(
    nowMs: number,
    gpuAllocationSnapshot: GpuAllocationSnapshot | null = null
  ): void {
    this.resetSession()
    this.isRecordingSession = true
    this.sessionStartGpuAllocationSnapshot = gpuAllocationSnapshot
    this.sessionStartMs = nowMs
  }

  stop(
    nowMs: number,
    gpuAllocationSnapshot: GpuAllocationSnapshot | null = null
  ): ProfileReport | null {
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
      indirectDraw:
        this.indirectCommandCount.summary().samples === 0
          ? null
          : {
              activeDrawCount: this.indirectActiveDrawCount.summary(),
              commandCount: this.indirectCommandCount.summary(),
              zeroedCommandCount: this.indirectZeroedCommandCount.summary(),
            },
      occlusion:
        this.occlusionActiveSlotCount.summary().samples === 0
          ? null
          : {
              activeSlotCount: this.occlusionActiveSlotCount.summary(),
              candidateVisibleChunkCount:
                this.occlusionCandidateVisibleChunkCount.summary(),
              culledSlotCount: this.occlusionCulledSlotCount.summary(),
            },
      allocation: buildAllocationSummary(
        this.sessionStartGpuAllocationSnapshot,
        gpuAllocationSnapshot
      ),
      memory: {
        gpuBytes: this.gpuMemoryBytes.summary(),
        jsHeapBytes:
          this.jsHeapBytes.summary().samples === 0
            ? null
            : this.jsHeapBytes.summary(),
      },
      meshGenerationChunkCount: this.meshGenerationChunkCount.summary(),
      meshGenerationPerChunkMs: this.meshGenerationPerChunkMs.summary(),
      meshGenerationTimeMs: {
        ...this.meshGenerationTimeMs.summary(),
        total: this.meshGenerationTimeMs.totalValue(),
      },
      terrainGenerationChunkCount: this.terrainGenerationChunkCount.summary(),
      terrainGenerationPerChunkMs: this.terrainGenerationPerChunkMs.summary(),
      terrainGenerationTimeMs: {
        ...this.terrainGenerationTimeMs.summary(),
        total: this.terrainGenerationTimeMs.totalValue(),
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
    this.indirectActiveDrawCount.reset()
    this.indirectCommandCount.reset()
    this.indirectZeroedCommandCount.reset()
    this.jsHeapBytes.reset()
    this.meshGenerationChunkCount.reset()
    this.meshGenerationPerChunkMs.reset()
    this.meshGenerationTimeMs.reset()
    this.occlusionActiveSlotCount.reset()
    this.occlusionCandidateVisibleChunkCount.reset()
    this.occlusionCulledSlotCount.reset()
    this.terrainGenerationChunkCount.reset()
    this.terrainGenerationPerChunkMs.reset()
    this.terrainGenerationTimeMs.reset()
    this.triangleCount.reset()
    this.sessionStartGpuAllocationSnapshot = null
  }
}
