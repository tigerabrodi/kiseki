import { describe, expect, it } from 'vitest'

import type { KisekiDebugStats } from '../debug/installKisekiDebugSurface.ts'
import { ProfileRecorder } from '../profiling/ProfileRecorder.ts'
import {
  createProfileFrameWork,
  recordProfileFrame,
} from './profileFrameWork.ts'

function createStats(position: {
  x: number
  y: number
  z: number
}): KisekiDebugStats {
  return {
    cpuTimeMs: 2,
    drawCalls: 12,
    editedVoxelCount: 0,
    faceCount: 1200,
    fps: 60,
    gpuMeshBufferBytes: 1024,
    gpuMeshBufferCount: 1,
    gpuTimeMs: null,
    gpuVoxelBufferBytes: 2048,
    gpuVoxelBufferCount: 1,
    loadedChunkCount: 27,
    meshGenerationTimeMs: 0,
    pipelineState: 'GPU Full + Occlusion',
    playerChunk: { x: 0, y: 0, z: 0 },
    position,
    terrainGenerationTimeMs: 0,
    triangleCount: 2400,
    vertexBytesPerVertex: 16,
    visibleChunkCount: 18,
  }
}

describe('recordProfileFrame', () => {
  it('records chunk-boundary and post-render streaming context', () => {
    const recorder = new ProfileRecorder()

    recorder.start(0)
    recordProfileFrame({
      fixedStepCount: 1,
      frameTimeSeconds: 1 / 60,
      frameWork: createProfileFrameWork(),
      gpuMemoryBytes: 4096,
      gpuTimeMs: 1,
      pendingStreamLoadCount: 3,
      postRenderStreamCpuTimeMs: 0.25,
      preRenderCpuTimeMs: 1.5,
      previousPostRenderStreamCpuTimeMs: 0.75,
      previousPostRenderStreamedInChunkCount: 1,
      previousPostRenderStreamedOutChunkCount: 2,
      renderSubmitCpuTimeMs: 0.5,
      recorder,
      stats: createStats({ x: -0.5, y: 33, z: 64.25 }),
    })

    const report = recorder.stop(1000)

    expect(report?.pendingStreamLoadCount?.average).toBe(3)
    expect(report?.nearestChunkBoundaryDistance?.average).toBe(0.25)
    expect(report?.slowFrames[0]).toMatchObject({
      chunkLocalPosition: { x: 31.5, y: 1, z: 0.25 },
      nearestChunkBoundaryDistance: 0.25,
      pendingStreamLoadCount: 3,
      postRenderStreamCpuTimeMs: 0.25,
      preRenderCpuTimeMs: 1.5,
      previousPostRenderStreamCpuTimeMs: 0.75,
      previousPostRenderStreamedInChunkCount: 1,
      previousPostRenderStreamedOutChunkCount: 2,
      renderSubmitCpuTimeMs: 0.5,
    })
  })
})
