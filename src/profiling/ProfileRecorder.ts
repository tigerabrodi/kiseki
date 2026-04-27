import type { GpuAllocationSnapshot } from '../gpu/buildGpuAllocationSnapshot.ts'

export { formatProfileReport } from './formatProfileReport.ts'

export type ProfileFrameSample = {
  chunkLocalPosition?: ProfileVector3
  chunkCount: number
  cpuTimeMs: number
  drawCalls?: number
  frameTimeMs: number
  fixedStepCount?: number
  fps: number
  gpuMemoryBytes: number
  gpuStreamComputePassCount?: number
  gpuStreamSubmissionCount?: number
  gpuTimeMs: number | null
  jsHeapBytes: number | null
  lightGeneratedChunkCount?: number
  lightGenerationTimeMs?: number
  meshGenerationTimeMs?: number
  meshRebuiltChunkCount?: number
  nearestChunkBoundaryDistance?: number
  pendingStreamLoadCount?: number
  playerChunk?: ProfileVector3
  position?: ProfileVector3
  postRenderStreamCpuTimeMs?: number
  preRenderCpuTimeMs?: number
  previousPostRenderStreamCpuTimeMs?: number
  previousPostRenderStreamedInChunkCount?: number
  previousPostRenderStreamedOutChunkCount?: number
  renderSubmitCpuTimeMs?: number
  sdfGeneratedChunkCount?: number
  sdfGenerationTimeMs?: number
  streamedInChunkCount?: number
  streamedOutChunkCount?: number
  terrainGeneratedChunkCount?: number
  terrainGenerationTimeMs?: number
  timestampMs?: number
  triangleCount: number
  unaccountedFrameTimeMs?: number
  visibleChunkCount?: number
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
  light: ProfileAllocationPoolSummary | null
  mesh: ProfileAllocationPoolSummary | null
  sdf: ProfileAllocationPoolSummary | null
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

export type ProfileVector3 = {
  x: number
  y: number
  z: number
}

export type ProfileSlowFrameSample = {
  chunkLocalPosition: ProfileVector3 | null
  chunkCount: number
  cpuTimeMs: number
  drawCalls: number | null
  elapsedSeconds: number
  fps: number
  frameTimeMs: number
  fixedStepCount: number
  gpuStreamComputePassCount: number
  gpuStreamSubmissionCount: number
  gpuTimeMs: number | null
  jsHeapBytes: number | null
  lightGeneratedChunkCount: number
  lightGenerationTimeMs: number
  meshGenerationTimeMs: number
  meshRebuiltChunkCount: number
  nearestChunkBoundaryDistance: number | null
  pendingStreamLoadCount: number | null
  playerChunk: ProfileVector3 | null
  position: ProfileVector3 | null
  postRenderStreamCpuTimeMs: number
  preRenderCpuTimeMs: number
  previousPostRenderStreamCpuTimeMs: number
  previousPostRenderStreamedInChunkCount: number
  previousPostRenderStreamedOutChunkCount: number
  renderSubmitCpuTimeMs: number
  sdfGeneratedChunkCount: number
  sdfGenerationTimeMs: number
  streamedInChunkCount: number
  streamedOutChunkCount: number
  terrainGeneratedChunkCount: number
  terrainGenerationTimeMs: number
  triangleCount: number
  unaccountedFrameTimeMs: number
  visibleChunkCount: number | null
}

export type ProfileReport = {
  chunkCount: ProfileMetricSummary
  cpuTimeMs: ProfileMetricSummary
  durationSeconds: number
  fps: ProfileMetricSummary
  frameCount: number
  frameTimeMs: ProfileMetricSummary
  fixedStepCount: ProfileMetricSummary
  gpuTimeMs: ProfileMetricSummary | null
  gpuStreamComputePassCount: ProfileMetricSummary
  gpuStreamSubmissionCount: ProfileMetricSummary
  indirectDraw: ProfileIndirectDrawSummary | null
  lightGenerationChunkCount: ProfileMetricSummary
  lightGenerationPerChunkMs: ProfileMetricSummary
  lightGenerationTimeMs: ProfileMeshGenerationSummary
  occlusion: ProfileOcclusionSummary | null
  allocation: ProfileAllocationSummary | null
  memory: ProfileMemorySummary
  meshGenerationChunkCount: ProfileMetricSummary
  meshGenerationPerChunkMs: ProfileMetricSummary
  meshGenerationTimeMs: ProfileMeshGenerationSummary
  nearestChunkBoundaryDistance: ProfileMetricSummary | null
  pendingStreamLoadCount: ProfileMetricSummary | null
  postRenderStreamCpuTimeMs: ProfileMetricSummary
  preRenderCpuTimeMs: ProfileMetricSummary
  previousPostRenderStreamCpuTimeMs: ProfileMetricSummary
  sdfGenerationChunkCount: ProfileMetricSummary
  sdfGenerationPerChunkMs: ProfileMetricSummary
  sdfGenerationTimeMs: ProfileMeshGenerationSummary
  slowFrames: Array<ProfileSlowFrameSample>
  terrainGenerationChunkCount: ProfileMetricSummary
  terrainGenerationPerChunkMs: ProfileMetricSummary
  terrainGenerationTimeMs: ProfileMeshGenerationSummary
  triangleCount: ProfileMetricSummary
  unaccountedFrameTimeMs: ProfileMetricSummary
  renderSubmitCpuTimeMs: ProfileMetricSummary
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

const MAX_SLOW_FRAME_SAMPLE_COUNT = 5

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

function cloneVector3(
  value: ProfileVector3 | undefined
): ProfileVector3 | null {
  if (value === undefined) {
    return null
  }

  return {
    x: value.x,
    y: value.y,
    z: value.z,
  }
}

function estimateUnaccountedFrameTimeMs(sample: ProfileFrameSample): number {
  return Math.max(
    0,
    sample.unaccountedFrameTimeMs ??
      sample.frameTimeMs - sample.cpuTimeMs - (sample.gpuTimeMs ?? 0)
  )
}

function createSlowFrameSample(
  sample: ProfileFrameSample,
  elapsedSeconds: number
): ProfileSlowFrameSample {
  return {
    chunkLocalPosition: cloneVector3(sample.chunkLocalPosition),
    chunkCount: sample.chunkCount,
    cpuTimeMs: sample.cpuTimeMs,
    drawCalls: sample.drawCalls ?? null,
    elapsedSeconds,
    fps: sample.fps,
    frameTimeMs: sample.frameTimeMs,
    fixedStepCount: sample.fixedStepCount ?? 0,
    gpuStreamComputePassCount: sample.gpuStreamComputePassCount ?? 0,
    gpuStreamSubmissionCount: sample.gpuStreamSubmissionCount ?? 0,
    gpuTimeMs: sample.gpuTimeMs,
    jsHeapBytes: sample.jsHeapBytes,
    lightGeneratedChunkCount: sample.lightGeneratedChunkCount ?? 0,
    lightGenerationTimeMs: sample.lightGenerationTimeMs ?? 0,
    meshGenerationTimeMs: sample.meshGenerationTimeMs ?? 0,
    meshRebuiltChunkCount: sample.meshRebuiltChunkCount ?? 0,
    nearestChunkBoundaryDistance: sample.nearestChunkBoundaryDistance ?? null,
    pendingStreamLoadCount: sample.pendingStreamLoadCount ?? null,
    playerChunk: cloneVector3(sample.playerChunk),
    position: cloneVector3(sample.position),
    postRenderStreamCpuTimeMs: sample.postRenderStreamCpuTimeMs ?? 0,
    preRenderCpuTimeMs: sample.preRenderCpuTimeMs ?? 0,
    previousPostRenderStreamCpuTimeMs:
      sample.previousPostRenderStreamCpuTimeMs ?? 0,
    previousPostRenderStreamedInChunkCount:
      sample.previousPostRenderStreamedInChunkCount ?? 0,
    previousPostRenderStreamedOutChunkCount:
      sample.previousPostRenderStreamedOutChunkCount ?? 0,
    renderSubmitCpuTimeMs: sample.renderSubmitCpuTimeMs ?? 0,
    sdfGeneratedChunkCount: sample.sdfGeneratedChunkCount ?? 0,
    sdfGenerationTimeMs: sample.sdfGenerationTimeMs ?? 0,
    streamedInChunkCount: sample.streamedInChunkCount ?? 0,
    streamedOutChunkCount: sample.streamedOutChunkCount ?? 0,
    terrainGeneratedChunkCount: sample.terrainGeneratedChunkCount ?? 0,
    terrainGenerationTimeMs: sample.terrainGenerationTimeMs ?? 0,
    triangleCount: sample.triangleCount,
    unaccountedFrameTimeMs: estimateUnaccountedFrameTimeMs(sample),
    visibleChunkCount: sample.visibleChunkCount ?? null,
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
    light: buildAllocationPoolSummary(start.light, end.light),
    mesh: buildAllocationPoolSummary(start.mesh, end.mesh),
    sdf: buildAllocationPoolSummary(start.sdf, end.sdf),
    totalBufferCount,
    totalReservedByteLength,
    voxel: buildAllocationPoolSummary(start.voxel, end.voxel),
  }
}

export class ProfileRecorder {
  private readonly chunkCount = new MetricAccumulator()
  private readonly cpuTimeMs = new MetricAccumulator()
  private readonly frameTimeMs = new MetricAccumulator()
  private readonly fixedStepCount = new MetricAccumulator()
  private readonly fps = new MetricAccumulator()
  private readonly gpuMemoryBytes = new MetricAccumulator()
  private readonly gpuStreamComputePassCount = new MetricAccumulator()
  private readonly gpuStreamSubmissionCount = new MetricAccumulator()
  private readonly gpuTimeMs = new MetricAccumulator()
  private readonly indirectActiveDrawCount = new MetricAccumulator()
  private readonly indirectCommandCount = new MetricAccumulator()
  private readonly indirectZeroedCommandCount = new MetricAccumulator()
  private readonly jsHeapBytes = new MetricAccumulator()
  private readonly lightGenerationChunkCount = new MetricAccumulator()
  private readonly lightGenerationPerChunkMs = new MetricAccumulator()
  private readonly lightGenerationTimeMs = new MetricAccumulator()
  private readonly meshGenerationChunkCount = new MetricAccumulator()
  private readonly meshGenerationPerChunkMs = new MetricAccumulator()
  private readonly meshGenerationTimeMs = new MetricAccumulator()
  private readonly nearestChunkBoundaryDistance = new MetricAccumulator()
  private readonly occlusionActiveSlotCount = new MetricAccumulator()
  private readonly occlusionCandidateVisibleChunkCount = new MetricAccumulator()
  private readonly occlusionCulledSlotCount = new MetricAccumulator()
  private readonly pendingStreamLoadCount = new MetricAccumulator()
  private readonly postRenderStreamCpuTimeMs = new MetricAccumulator()
  private readonly preRenderCpuTimeMs = new MetricAccumulator()
  private readonly previousPostRenderStreamCpuTimeMs = new MetricAccumulator()
  private readonly renderSubmitCpuTimeMs = new MetricAccumulator()
  private readonly sdfGenerationChunkCount = new MetricAccumulator()
  private readonly sdfGenerationPerChunkMs = new MetricAccumulator()
  private readonly sdfGenerationTimeMs = new MetricAccumulator()
  private readonly terrainGenerationChunkCount = new MetricAccumulator()
  private readonly terrainGenerationPerChunkMs = new MetricAccumulator()
  private readonly terrainGenerationTimeMs = new MetricAccumulator()
  private readonly triangleCount = new MetricAccumulator()
  private readonly unaccountedFrameTimeMs = new MetricAccumulator()

  private isRecordingSession = false
  private lastReportValue: ProfileReport | null = null
  private sessionStartGpuAllocationSnapshot: GpuAllocationSnapshot | null = null
  private sessionStartMs = 0
  private slowFrames: Array<ProfileSlowFrameSample> = []

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
    this.frameTimeMs.add(sample.frameTimeMs)
    this.fixedStepCount.add(sample.fixedStepCount ?? 0)
    this.fps.add(sample.fps)
    this.gpuMemoryBytes.add(sample.gpuMemoryBytes)
    this.gpuStreamComputePassCount.add(sample.gpuStreamComputePassCount ?? 0)
    this.gpuStreamSubmissionCount.add(sample.gpuStreamSubmissionCount ?? 0)
    this.postRenderStreamCpuTimeMs.add(sample.postRenderStreamCpuTimeMs ?? 0)
    this.preRenderCpuTimeMs.add(sample.preRenderCpuTimeMs ?? 0)
    this.previousPostRenderStreamCpuTimeMs.add(
      sample.previousPostRenderStreamCpuTimeMs ?? 0
    )
    this.renderSubmitCpuTimeMs.add(sample.renderSubmitCpuTimeMs ?? 0)
    this.triangleCount.add(sample.triangleCount)
    this.unaccountedFrameTimeMs.add(estimateUnaccountedFrameTimeMs(sample))
    this.recordSlowFrame(sample)

    if (sample.nearestChunkBoundaryDistance !== undefined) {
      this.nearestChunkBoundaryDistance.add(sample.nearestChunkBoundaryDistance)
    }

    if (sample.pendingStreamLoadCount !== undefined) {
      this.pendingStreamLoadCount.add(sample.pendingStreamLoadCount)
    }

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

  recordSdfGeneration(durationMs: number, chunkCount: number): void {
    if (!this.isRecordingSession) {
      return
    }

    this.sdfGenerationTimeMs.add(durationMs)

    if (chunkCount > 0) {
      this.sdfGenerationChunkCount.add(chunkCount)
      this.sdfGenerationPerChunkMs.add(durationMs / chunkCount)
    }
  }

  recordLightGeneration(durationMs: number, chunkCount: number): void {
    if (!this.isRecordingSession) {
      return
    }

    this.lightGenerationTimeMs.add(durationMs)

    if (chunkCount > 0) {
      this.lightGenerationChunkCount.add(chunkCount)
      this.lightGenerationPerChunkMs.add(durationMs / chunkCount)
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
      frameTimeMs: this.frameTimeMs.summary(),
      fixedStepCount: this.fixedStepCount.summary(),
      gpuTimeMs:
        this.gpuTimeMs.summary().samples === 0
          ? null
          : this.gpuTimeMs.summary(),
      gpuStreamComputePassCount: this.gpuStreamComputePassCount.summary(),
      gpuStreamSubmissionCount: this.gpuStreamSubmissionCount.summary(),
      indirectDraw:
        this.indirectCommandCount.summary().samples === 0
          ? null
          : {
              activeDrawCount: this.indirectActiveDrawCount.summary(),
              commandCount: this.indirectCommandCount.summary(),
              zeroedCommandCount: this.indirectZeroedCommandCount.summary(),
            },
      lightGenerationChunkCount: this.lightGenerationChunkCount.summary(),
      lightGenerationPerChunkMs: this.lightGenerationPerChunkMs.summary(),
      lightGenerationTimeMs: {
        ...this.lightGenerationTimeMs.summary(),
        total: this.lightGenerationTimeMs.totalValue(),
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
      nearestChunkBoundaryDistance:
        this.nearestChunkBoundaryDistance.summary().samples === 0
          ? null
          : this.nearestChunkBoundaryDistance.summary(),
      sdfGenerationChunkCount: this.sdfGenerationChunkCount.summary(),
      sdfGenerationPerChunkMs: this.sdfGenerationPerChunkMs.summary(),
      sdfGenerationTimeMs: {
        ...this.sdfGenerationTimeMs.summary(),
        total: this.sdfGenerationTimeMs.totalValue(),
      },
      pendingStreamLoadCount:
        this.pendingStreamLoadCount.summary().samples === 0
          ? null
          : this.pendingStreamLoadCount.summary(),
      postRenderStreamCpuTimeMs: this.postRenderStreamCpuTimeMs.summary(),
      preRenderCpuTimeMs: this.preRenderCpuTimeMs.summary(),
      previousPostRenderStreamCpuTimeMs:
        this.previousPostRenderStreamCpuTimeMs.summary(),
      renderSubmitCpuTimeMs: this.renderSubmitCpuTimeMs.summary(),
      slowFrames: this.slowFrames.map((frame) => ({ ...frame })),
      terrainGenerationChunkCount: this.terrainGenerationChunkCount.summary(),
      terrainGenerationPerChunkMs: this.terrainGenerationPerChunkMs.summary(),
      terrainGenerationTimeMs: {
        ...this.terrainGenerationTimeMs.summary(),
        total: this.terrainGenerationTimeMs.totalValue(),
      },
      triangleCount: this.triangleCount.summary(),
      unaccountedFrameTimeMs: this.unaccountedFrameTimeMs.summary(),
    }

    this.lastReportValue = report

    return report
  }

  private recordSlowFrame(sample: ProfileFrameSample): void {
    const elapsedSeconds =
      sample.timestampMs === undefined
        ? 0
        : Math.max(0, sample.timestampMs - this.sessionStartMs) / 1000
    const slowFrame = createSlowFrameSample(sample, elapsedSeconds)

    this.slowFrames.push(slowFrame)
    this.slowFrames.sort((a, b) => b.frameTimeMs - a.frameTimeMs)

    if (this.slowFrames.length > MAX_SLOW_FRAME_SAMPLE_COUNT) {
      this.slowFrames.length = MAX_SLOW_FRAME_SAMPLE_COUNT
    }
  }

  private resetSession(): void {
    this.chunkCount.reset()
    this.cpuTimeMs.reset()
    this.frameTimeMs.reset()
    this.fixedStepCount.reset()
    this.fps.reset()
    this.gpuMemoryBytes.reset()
    this.gpuStreamComputePassCount.reset()
    this.gpuStreamSubmissionCount.reset()
    this.gpuTimeMs.reset()
    this.indirectActiveDrawCount.reset()
    this.indirectCommandCount.reset()
    this.indirectZeroedCommandCount.reset()
    this.jsHeapBytes.reset()
    this.lightGenerationChunkCount.reset()
    this.lightGenerationPerChunkMs.reset()
    this.lightGenerationTimeMs.reset()
    this.meshGenerationChunkCount.reset()
    this.meshGenerationPerChunkMs.reset()
    this.meshGenerationTimeMs.reset()
    this.nearestChunkBoundaryDistance.reset()
    this.occlusionActiveSlotCount.reset()
    this.occlusionCandidateVisibleChunkCount.reset()
    this.occlusionCulledSlotCount.reset()
    this.pendingStreamLoadCount.reset()
    this.postRenderStreamCpuTimeMs.reset()
    this.preRenderCpuTimeMs.reset()
    this.previousPostRenderStreamCpuTimeMs.reset()
    this.renderSubmitCpuTimeMs.reset()
    this.sdfGenerationChunkCount.reset()
    this.sdfGenerationPerChunkMs.reset()
    this.sdfGenerationTimeMs.reset()
    this.terrainGenerationChunkCount.reset()
    this.terrainGenerationPerChunkMs.reset()
    this.terrainGenerationTimeMs.reset()
    this.triangleCount.reset()
    this.unaccountedFrameTimeMs.reset()
    this.sessionStartGpuAllocationSnapshot = null
    this.slowFrames = []
  }
}
