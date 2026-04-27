import type {
  ProfileMetricDelta,
  ProfileMetricSummary,
  ProfileReport,
  ProfileSlowFrameSample,
  ProfileVector3,
} from './ProfileRecorder.ts'

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
    `Frame ms avg/min/max: ${formatMetric(report.frameTimeMs)}`,
    `Unaccounted frame ms avg/min/max: ${formatMetric(report.unaccountedFrameTimeMs)}`,
    `Fixed steps avg/min/max: ${formatMetric(report.fixedStepCount, 1)}`,
    `CPU phase ms pre/render/post-stream avg/max: ${formatMetricAverageMax(report.preRenderCpuTimeMs)} / ${formatMetricAverageMax(report.renderSubmitCpuTimeMs)} / ${formatMetricAverageMax(report.postRenderStreamCpuTimeMs)}`,
    `Previous post-stream CPU ms avg/max: ${formatMetricAverageMax(report.previousPostRenderStreamCpuTimeMs)}`,
    `Stream pending loads avg/min/max: ${
      report.pendingStreamLoadCount === null
        ? 'Unavailable'
        : formatMetric(report.pendingStreamLoadCount, 1)
    }`,
    `Nearest chunk boundary dist avg/min/max: ${
      report.nearestChunkBoundaryDistance === null
        ? 'Unavailable'
        : formatMetric(report.nearestChunkBoundaryDistance)
    }`,
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
    `SDF dispatches: ${report.sdfGenerationTimeMs.samples}`,
    `SDF chunks avg/min/max: ${formatMetric(report.sdfGenerationChunkCount, 1)}`,
    `SDF ms avg/max/total: ${report.sdfGenerationTimeMs.average.toFixed(2)} / ${report.sdfGenerationTimeMs.max.toFixed(2)} / ${report.sdfGenerationTimeMs.total.toFixed(2)}`,
    `SDF ms/chunk avg/min/max: ${formatMetric(report.sdfGenerationPerChunkMs)}`,
    `Light dispatches: ${report.lightGenerationTimeMs.samples}`,
    `Light chunks avg/min/max: ${formatMetric(report.lightGenerationChunkCount, 1)}`,
    `Light ms avg/max/total: ${report.lightGenerationTimeMs.average.toFixed(2)} / ${report.lightGenerationTimeMs.max.toFixed(2)} / ${report.lightGenerationTimeMs.total.toFixed(2)}`,
    `Light ms/chunk avg/min/max: ${formatMetric(report.lightGenerationPerChunkMs)}`,
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
    `SDF slot ops alloc/free/high-water: ${
      report.allocation?.sdf === null || report.allocation === null
        ? 'Unavailable'
        : `${report.allocation.sdf.slotAllocationCount} / ${report.allocation.sdf.slotReleaseCount} / ${report.allocation.sdf.highWaterCount}`
    }`,
    `Light slot ops alloc/free/high-water: ${
      report.allocation?.light === null || report.allocation === null
        ? 'Unavailable'
        : `${report.allocation.light.slotAllocationCount} / ${report.allocation.light.slotReleaseCount} / ${report.allocation.light.highWaterCount}`
    }`,
    `JS heap avg/max: ${
      report.memory.jsHeapBytes === null
        ? 'Unavailable'
        : `${formatBytes(report.memory.jsHeapBytes.average)} / ${formatBytes(report.memory.jsHeapBytes.max)}`
    }`,
    ...formatSlowFrames(report.slowFrames),
  ]

  return lines.join('\n')
}

function formatNullableBytes(bytes: number | null): string {
  return bytes === null ? 'Unavailable' : formatBytes(bytes)
}

function formatNullableMetric(value: number | null): string {
  return value === null ? 'Unavailable' : value.toFixed(2)
}

function formatNullableMetricValue(value: number | null): string {
  return value === null ? 'Unavailable' : value.toFixed(2)
}

function formatNullableNumber(value: number | null): string {
  return value === null ? 'Unavailable' : value.toString()
}

function formatVector3(value: ProfileVector3 | null): string {
  if (value === null) {
    return 'Unavailable'
  }

  return `${value.x.toFixed(1)},${value.y.toFixed(1)},${value.z.toFixed(1)}`
}

function formatSlowFrames(
  slowFrames: Array<ProfileSlowFrameSample>
): Array<string> {
  if (slowFrames.length === 0) {
    return ['Worst frames: Unavailable']
  }

  return [
    'Worst frames:',
    ...slowFrames.map((frame, index) => {
      const generationCounts = `${frame.terrainGeneratedChunkCount}/${frame.sdfGeneratedChunkCount}/${frame.lightGeneratedChunkCount}/${frame.meshRebuiltChunkCount}`
      const generationTimes = `${frame.terrainGenerationTimeMs.toFixed(2)}/${frame.sdfGenerationTimeMs.toFixed(2)}/${frame.lightGenerationTimeMs.toFixed(2)}/${frame.meshGenerationTimeMs.toFixed(2)} ms`
      const phaseTimes = `${frame.preRenderCpuTimeMs.toFixed(2)}/${frame.renderSubmitCpuTimeMs.toFixed(2)}/${frame.postRenderStreamCpuTimeMs.toFixed(2)} ms`
      const previousPostStream = `+${frame.previousPostRenderStreamedInChunkCount}/-${frame.previousPostRenderStreamedOutChunkCount} ${frame.previousPostRenderStreamCpuTimeMs.toFixed(2)} ms`

      return `Worst frame ${index + 1}: ${frame.frameTimeMs.toFixed(2)} ms @ ${frame.elapsedSeconds.toFixed(1)}s (${frame.fps.toFixed(2)} FPS), CPU ${frame.cpuTimeMs.toFixed(2)} ms, GPU ${formatNullableMetric(frame.gpuTimeMs)} ms, unaccounted ${frame.unaccountedFrameTimeMs.toFixed(2)} ms, fixed steps ${frame.fixedStepCount}, phase pre/render/post-stream ${phaseTimes}, prev post-stream ${previousPostStream}, chunks ${frame.chunkCount}/${formatNullableNumber(frame.visibleChunkCount)} visible, pending loads ${formatNullableNumber(frame.pendingStreamLoadCount)}, triangles ${frame.triangleCount}, draws ${formatNullableNumber(frame.drawCalls)}, stream +${frame.streamedInChunkCount}/-${frame.streamedOutChunkCount}, gen T/SDF/L/M ${generationCounts}, gen ms T/SDF/L/M ${generationTimes}, heap ${formatNullableBytes(frame.jsHeapBytes)}, pos ${formatVector3(frame.position)}, chunk ${formatVector3(frame.playerChunk)}, local ${formatVector3(frame.chunkLocalPosition)}, nearest boundary ${formatNullableMetricValue(frame.nearestChunkBoundaryDistance)}`
    }),
  ]
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

function formatMetricAverageMax(
  metric: ProfileMetricSummary,
  fractionDigits = 2
): string {
  return `${metric.average.toFixed(fractionDigits)} / ${metric.max.toFixed(
    fractionDigits
  )}`
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
