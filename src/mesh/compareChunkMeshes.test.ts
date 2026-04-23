import { describe, expect, it } from 'vitest'

import { Chunk } from '../voxel/chunk.ts'
import { buildChunkGeometryData } from './buildChunkGeometryData.ts'
import { compareChunkMeshes } from './compareChunkMeshes.ts'

describe('compareChunkMeshes', () => {
  it('treats equivalent quads as a match even when vertex groups are reordered', () => {
    const chunk = new Chunk()
    chunk.set(0, 0, 0, 1)

    const cpuMesh = buildChunkGeometryData(chunk)
    const gpuVertices = new Uint32Array(cpuMesh.packedVertices.length)

    for (let faceIndex = 0; faceIndex < cpuMesh.faceCount; faceIndex += 1) {
      const sourceOffset = faceIndex * 4
      const targetFaceIndex = cpuMesh.faceCount - faceIndex - 1
      const targetOffset = targetFaceIndex * 4
      const sourceQuad = cpuMesh.packedVertices.slice(
        sourceOffset,
        sourceOffset + 4
      )

      gpuVertices[targetOffset] = sourceQuad[2] ?? 0
      gpuVertices[targetOffset + 1] = sourceQuad[0] ?? 0
      gpuVertices[targetOffset + 2] = sourceQuad[3] ?? 0
      gpuVertices[targetOffset + 3] = sourceQuad[1] ?? 0
    }

    const gpuMesh = {
      faceCount: cpuMesh.faceCount,
      indexCount: cpuMesh.indexCount,
      indices: cpuMesh.indices,
      packedVertices: gpuVertices,
      vertexCount: cpuMesh.vertexCount,
      visibleFaceCount: cpuMesh.visibleFaceCount,
    }

    expect(compareChunkMeshes(cpuMesh, gpuMesh).matches).toBe(true)
  })

  it('rejects mismatched index patterns even when quad signatures match', () => {
    const chunk = new Chunk()
    chunk.set(0, 0, 0, 1)

    const cpuMesh = buildChunkGeometryData(chunk)
    const brokenIndices = cpuMesh.indices.slice()
    brokenIndices[0] = 99

    const gpuMesh = {
      faceCount: cpuMesh.faceCount,
      indexCount: cpuMesh.indexCount,
      indices: brokenIndices,
      packedVertices: cpuMesh.packedVertices,
      vertexCount: cpuMesh.vertexCount,
      visibleFaceCount: cpuMesh.visibleFaceCount,
    }

    const comparison = compareChunkMeshes(cpuMesh, gpuMesh)

    expect(comparison.quadSignatureMatches).toBe(true)
    expect(comparison.indexPatternMatches).toBe(false)
    expect(comparison.matches).toBe(false)
  })
})
