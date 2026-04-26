import type { KisekiDebugStats } from '../debug/installKisekiDebugSurface.ts'
import { chunkKey } from '../world/World.ts'
import { bytesToMegabytes } from './debugWorldHelpers.ts'

type DebugStatsHudElements = {
  chunkCountValue: HTMLElement
  cpuTimeValue: HTMLElement
  drawCallsValue: HTMLElement
  editedVoxelsValue: HTMLElement
  faceCountValue: HTMLElement
  fpsValue: HTMLElement
  gpuMeshCountValue: HTMLElement
  gpuMeshMegabytesValue: HTMLElement
  gpuTimeValue: HTMLElement
  gpuVoxelCountValue: HTMLElement
  gpuVoxelMegabytesValue: HTMLElement
  meshTimeValue: HTMLElement
  pipelineStateValue: HTMLElement
  playerChunkValue: HTMLElement
  positionValue: HTMLElement
  terrainTimeValue: HTMLElement
  triangleCountValue: HTMLElement
  vertexBytesValue: HTMLElement
  visibleChunksValue: HTMLElement
}

export function applyDebugStatsHud(
  elements: DebugStatsHudElements,
  stats: KisekiDebugStats
): void {
  elements.fpsValue.textContent = stats.fps.toFixed(1)
  elements.cpuTimeValue.textContent = stats.cpuTimeMs.toFixed(2)
  elements.gpuTimeValue.textContent =
    stats.gpuTimeMs === null ? 'n/a' : stats.gpuTimeMs.toFixed(2)
  elements.meshTimeValue.textContent = stats.meshGenerationTimeMs.toFixed(2)
  elements.terrainTimeValue.textContent =
    stats.terrainGenerationTimeMs.toFixed(2)
  elements.gpuVoxelCountValue.textContent = stats.gpuVoxelBufferCount.toString()
  elements.gpuVoxelMegabytesValue.textContent = bytesToMegabytes(
    stats.gpuVoxelBufferBytes
  ).toFixed(2)
  elements.gpuMeshCountValue.textContent = stats.gpuMeshBufferCount.toString()
  elements.gpuMeshMegabytesValue.textContent = bytesToMegabytes(
    stats.gpuMeshBufferBytes
  ).toFixed(2)
  elements.vertexBytesValue.textContent = stats.vertexBytesPerVertex.toString()
  elements.pipelineStateValue.textContent = stats.pipelineState
  elements.chunkCountValue.textContent = stats.loadedChunkCount.toString()
  elements.playerChunkValue.textContent = chunkKey(stats.playerChunk)
  elements.visibleChunksValue.textContent = stats.visibleChunkCount.toString()
  elements.positionValue.textContent = `${stats.position.x.toFixed(
    1
  )}, ${stats.position.y.toFixed(1)}, ${stats.position.z.toFixed(1)}`
  elements.faceCountValue.textContent = stats.faceCount.toString()
  elements.triangleCountValue.textContent = stats.triangleCount.toString()
  elements.drawCallsValue.textContent = stats.drawCalls.toString()
  elements.editedVoxelsValue.textContent = stats.editedVoxelCount.toString()
}
