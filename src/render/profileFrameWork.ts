import type { ProfileRecorder } from '../profiling/ProfileRecorder.ts'
import type { KisekiDebugStats } from '../debug/installKisekiDebugSurface.ts'
import {
  type ChunkStreamUpdate,
  worldPositionToChunkCoordinates,
} from '../world/ChunkStreamer.ts'
import { CHUNK_SIZE } from '../voxel/chunk.ts'
import { getJsHeapBytes } from './debugWorldHelpers.ts'

type ProfileFrameWork = {
  gpuComputePassCount: number
  gpuSubmissionCount: number
  lightGeneratedChunkCount: number
  lightGenerationTimeMs: number
  meshGenerationTimeMs: number
  meshRebuiltChunkCount: number
  sdfGeneratedChunkCount: number
  sdfGenerationTimeMs: number
  streamedInChunkCount: number
  streamedOutChunkCount: number
  terrainGeneratedChunkCount: number
  terrainGenerationTimeMs: number
}

type ProfileFrameRecordOptions = {
  fixedStepCount: number
  frameTimeSeconds: number
  frameWork: ProfileFrameWork
  gpuMemoryBytes: number
  gpuTimeMs: number | null
  pendingStreamLoadCount: number
  postRenderStreamCpuTimeMs: number
  preRenderCpuTimeMs: number
  previousPostRenderStreamCpuTimeMs: number
  previousPostRenderStreamedInChunkCount: number
  previousPostRenderStreamedOutChunkCount: number
  renderSubmitCpuTimeMs: number
  recorder: ProfileRecorder
  stats: KisekiDebugStats
}

export function createProfileFrameWork(): ProfileFrameWork {
  return {
    gpuComputePassCount: 0,
    gpuSubmissionCount: 0,
    lightGeneratedChunkCount: 0,
    lightGenerationTimeMs: 0,
    meshGenerationTimeMs: 0,
    meshRebuiltChunkCount: 0,
    sdfGeneratedChunkCount: 0,
    sdfGenerationTimeMs: 0,
    streamedInChunkCount: 0,
    streamedOutChunkCount: 0,
    terrainGeneratedChunkCount: 0,
    terrainGenerationTimeMs: 0,
  }
}

export function addProfileStreamWork(
  frameWork: ProfileFrameWork,
  update: ChunkStreamUpdate
): void {
  frameWork.streamedInChunkCount += update.loaded.length
  frameWork.streamedOutChunkCount += update.unloaded.length
}

export function addProfileTerrainWork(
  frameWork: ProfileFrameWork,
  result: {
    generatedChunkCount: number
    gpuComputePassCount: number
    gpuSubmissionCount: number
    terrainGenerationTimeMs: number
  }
): void {
  frameWork.gpuComputePassCount += result.gpuComputePassCount
  frameWork.gpuSubmissionCount += result.gpuSubmissionCount
  frameWork.terrainGeneratedChunkCount += result.generatedChunkCount
  frameWork.terrainGenerationTimeMs += result.terrainGenerationTimeMs
}

export function addProfileSdfWork(
  frameWork: ProfileFrameWork,
  result: {
    generatedChunkCount: number
    gpuComputePassCount: number
    gpuSubmissionCount: number
    sdfGenerationTimeMs: number
  }
): void {
  frameWork.gpuComputePassCount += result.gpuComputePassCount
  frameWork.gpuSubmissionCount += result.gpuSubmissionCount
  frameWork.sdfGeneratedChunkCount += result.generatedChunkCount
  frameWork.sdfGenerationTimeMs += result.sdfGenerationTimeMs
}

export function addProfileLightWork(
  frameWork: ProfileFrameWork,
  result: {
    generatedChunkCount: number
    gpuComputePassCount: number
    gpuSubmissionCount: number
    lightGenerationTimeMs: number
  }
): void {
  frameWork.gpuComputePassCount += result.gpuComputePassCount
  frameWork.gpuSubmissionCount += result.gpuSubmissionCount
  frameWork.lightGeneratedChunkCount += result.generatedChunkCount
  frameWork.lightGenerationTimeMs += result.lightGenerationTimeMs
}

export function addProfileMeshWork(
  frameWork: ProfileFrameWork,
  result: {
    gpuComputePassCount: number
    gpuSubmissionCount: number
    meshGenerationTimeMs: number
    remeshedChunkCount: number
  }
): void {
  frameWork.gpuComputePassCount += result.gpuComputePassCount
  frameWork.gpuSubmissionCount += result.gpuSubmissionCount
  frameWork.meshGenerationTimeMs += result.meshGenerationTimeMs
  frameWork.meshRebuiltChunkCount += result.remeshedChunkCount
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function getChunkLocalPosition(position: { x: number; y: number; z: number }): {
  x: number
  y: number
  z: number
} {
  return {
    x: positiveModulo(position.x, CHUNK_SIZE),
    y: positiveModulo(position.y, CHUNK_SIZE),
    z: positiveModulo(position.z, CHUNK_SIZE),
  }
}

function getNearestBoundaryDistance(localPosition: {
  x: number
  y: number
  z: number
}): number {
  return Math.min(
    localPosition.x,
    CHUNK_SIZE - localPosition.x,
    localPosition.y,
    CHUNK_SIZE - localPosition.y,
    localPosition.z,
    CHUNK_SIZE - localPosition.z
  )
}

export function recordProfileFrame(
  options: ProfileFrameRecordOptions
): ProfileFrameWork {
  const frameTimeMs = options.frameTimeSeconds * 1000
  const chunkLocalPosition = getChunkLocalPosition(options.stats.position)

  options.recorder.recordFrame({
    chunkLocalPosition,
    chunkCount: options.stats.loadedChunkCount,
    cpuTimeMs: options.stats.cpuTimeMs,
    drawCalls: options.stats.drawCalls,
    fixedStepCount: options.fixedStepCount,
    frameTimeMs,
    fps: 1 / options.frameTimeSeconds,
    gpuMemoryBytes: options.gpuMemoryBytes,
    gpuStreamComputePassCount: options.frameWork.gpuComputePassCount,
    gpuStreamSubmissionCount: options.frameWork.gpuSubmissionCount,
    gpuTimeMs: options.gpuTimeMs,
    jsHeapBytes: getJsHeapBytes(),
    lightGeneratedChunkCount: options.frameWork.lightGeneratedChunkCount,
    lightGenerationTimeMs: options.frameWork.lightGenerationTimeMs,
    meshGenerationTimeMs: options.frameWork.meshGenerationTimeMs,
    meshRebuiltChunkCount: options.frameWork.meshRebuiltChunkCount,
    nearestChunkBoundaryDistance:
      getNearestBoundaryDistance(chunkLocalPosition),
    pendingStreamLoadCount: options.pendingStreamLoadCount,
    playerChunk: worldPositionToChunkCoordinates(options.stats.position),
    position: {
      x: options.stats.position.x,
      y: options.stats.position.y,
      z: options.stats.position.z,
    },
    postRenderStreamCpuTimeMs: options.postRenderStreamCpuTimeMs,
    preRenderCpuTimeMs: options.preRenderCpuTimeMs,
    previousPostRenderStreamCpuTimeMs:
      options.previousPostRenderStreamCpuTimeMs,
    previousPostRenderStreamedInChunkCount:
      options.previousPostRenderStreamedInChunkCount,
    previousPostRenderStreamedOutChunkCount:
      options.previousPostRenderStreamedOutChunkCount,
    renderSubmitCpuTimeMs: options.renderSubmitCpuTimeMs,
    sdfGeneratedChunkCount: options.frameWork.sdfGeneratedChunkCount,
    sdfGenerationTimeMs: options.frameWork.sdfGenerationTimeMs,
    streamedInChunkCount: options.frameWork.streamedInChunkCount,
    streamedOutChunkCount: options.frameWork.streamedOutChunkCount,
    terrainGeneratedChunkCount: options.frameWork.terrainGeneratedChunkCount,
    terrainGenerationTimeMs: options.frameWork.terrainGenerationTimeMs,
    timestampMs: performance.now(),
    triangleCount: options.stats.triangleCount,
    unaccountedFrameTimeMs: Math.max(
      0,
      frameTimeMs - options.stats.cpuTimeMs - (options.gpuTimeMs ?? 0)
    ),
    visibleChunkCount: options.stats.visibleChunkCount,
  })

  return createProfileFrameWork()
}
