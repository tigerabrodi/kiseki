import type { ProfileRecorder } from '../profiling/ProfileRecorder.ts'
import type { KisekiDebugStats } from '../debug/installKisekiDebugSurface.ts'
import {
  type ChunkStreamUpdate,
  worldPositionToChunkCoordinates,
} from '../world/ChunkStreamer.ts'
import { getJsHeapBytes } from './debugWorldHelpers.ts'

type ProfileFrameWork = {
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
  frameTimeSeconds: number
  frameWork: ProfileFrameWork
  gpuMemoryBytes: number
  gpuTimeMs: number | null
  recorder: ProfileRecorder
  stats: KisekiDebugStats
}

export function createProfileFrameWork(): ProfileFrameWork {
  return {
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
  result: { generatedChunkCount: number; terrainGenerationTimeMs: number }
): void {
  frameWork.terrainGeneratedChunkCount += result.generatedChunkCount
  frameWork.terrainGenerationTimeMs += result.terrainGenerationTimeMs
}

export function addProfileSdfWork(
  frameWork: ProfileFrameWork,
  result: { generatedChunkCount: number; sdfGenerationTimeMs: number }
): void {
  frameWork.sdfGeneratedChunkCount += result.generatedChunkCount
  frameWork.sdfGenerationTimeMs += result.sdfGenerationTimeMs
}

export function addProfileLightWork(
  frameWork: ProfileFrameWork,
  result: { generatedChunkCount: number; lightGenerationTimeMs: number }
): void {
  frameWork.lightGeneratedChunkCount += result.generatedChunkCount
  frameWork.lightGenerationTimeMs += result.lightGenerationTimeMs
}

export function addProfileMeshWork(
  frameWork: ProfileFrameWork,
  result: { meshGenerationTimeMs: number; remeshedChunkCount: number }
): void {
  frameWork.meshGenerationTimeMs += result.meshGenerationTimeMs
  frameWork.meshRebuiltChunkCount += result.remeshedChunkCount
}

export function recordProfileFrame(
  options: ProfileFrameRecordOptions
): ProfileFrameWork {
  options.recorder.recordFrame({
    chunkCount: options.stats.loadedChunkCount,
    cpuTimeMs: options.stats.cpuTimeMs,
    drawCalls: options.stats.drawCalls,
    frameTimeMs: options.frameTimeSeconds * 1000,
    fps: 1 / options.frameTimeSeconds,
    gpuMemoryBytes: options.gpuMemoryBytes,
    gpuTimeMs: options.gpuTimeMs,
    jsHeapBytes: getJsHeapBytes(),
    lightGeneratedChunkCount: options.frameWork.lightGeneratedChunkCount,
    lightGenerationTimeMs: options.frameWork.lightGenerationTimeMs,
    meshGenerationTimeMs: options.frameWork.meshGenerationTimeMs,
    meshRebuiltChunkCount: options.frameWork.meshRebuiltChunkCount,
    playerChunk: worldPositionToChunkCoordinates(options.stats.position),
    position: {
      x: options.stats.position.x,
      y: options.stats.position.y,
      z: options.stats.position.z,
    },
    sdfGeneratedChunkCount: options.frameWork.sdfGeneratedChunkCount,
    sdfGenerationTimeMs: options.frameWork.sdfGenerationTimeMs,
    streamedInChunkCount: options.frameWork.streamedInChunkCount,
    streamedOutChunkCount: options.frameWork.streamedOutChunkCount,
    terrainGeneratedChunkCount: options.frameWork.terrainGeneratedChunkCount,
    terrainGenerationTimeMs: options.frameWork.terrainGenerationTimeMs,
    timestampMs: performance.now(),
    triangleCount: options.stats.triangleCount,
    visibleChunkCount: options.stats.visibleChunkCount,
  })

  return createProfileFrameWork()
}
