import type { ChunkGeometryData } from './buildChunkGeometryData.ts'

export type ChunkMeshReadback = {
  faceCount: number
  indexCount: number
  indices: Uint32Array
  packedVertices: Uint32Array
  vertexCount: number
  visibleFaceCount: number
}

export type ChunkMeshComparison = {
  cpuFaceCount: number
  cpuIndexCount: number
  cpuVertexCount: number
  cpuVisibleFaceCount: number
  faceCountMatches: boolean
  gpuFaceCount: number
  gpuIndexCount: number
  gpuVertexCount: number
  gpuVisibleFaceCount: number
  indexCountMatches: boolean
  indexPatternMatches: boolean
  matches: boolean
  quadSignatureMatches: boolean
  vertexCountMatches: boolean
  visibleFaceCountMatches: boolean
}

function createQuadSignatures(packedVertices: Uint32Array): Array<string> {
  if (packedVertices.length % 4 !== 0) {
    throw new RangeError(
      `Packed vertex array length must be divisible by 4, got ${packedVertices.length}`
    )
  }

  const signatures: Array<string> = []

  for (let offset = 0; offset < packedVertices.length; offset += 4) {
    signatures.push(
      Array.from(packedVertices.slice(offset, offset + 4))
        .sort((a, b) => a - b)
        .join(',')
    )
  }

  return signatures.sort()
}

function hasExpectedQuadIndexPattern(
  indices: Uint32Array,
  faceCount: number
): boolean {
  if (indices.length !== faceCount * 6) {
    return false
  }

  for (let faceIndex = 0; faceIndex < faceCount; faceIndex += 1) {
    const vertexBase = faceIndex * 4
    const indexBase = faceIndex * 6

    if (
      indices[indexBase] !== vertexBase ||
      indices[indexBase + 1] !== vertexBase + 1 ||
      indices[indexBase + 2] !== vertexBase + 2 ||
      indices[indexBase + 3] !== vertexBase ||
      indices[indexBase + 4] !== vertexBase + 2 ||
      indices[indexBase + 5] !== vertexBase + 3
    ) {
      return false
    }
  }

  return true
}

export function compareChunkMeshes(
  cpuMesh: ChunkGeometryData,
  gpuMesh: ChunkMeshReadback
): ChunkMeshComparison {
  const cpuFaceCount = cpuMesh.faceCount
  const cpuVertexCount = cpuMesh.vertexCount
  const cpuIndexCount = cpuMesh.indexCount
  const cpuVisibleFaceCount = cpuMesh.visibleFaceCount
  const gpuFaceCount = gpuMesh.faceCount
  const gpuVertexCount = gpuMesh.vertexCount
  const gpuIndexCount = gpuMesh.indexCount
  const gpuVisibleFaceCount = gpuMesh.visibleFaceCount
  const hasFaceCountMatch = cpuFaceCount === gpuFaceCount
  const hasVertexCountMatch = cpuVertexCount === gpuVertexCount
  const hasIndexCountMatch = cpuIndexCount === gpuIndexCount
  const hasVisibleFaceCountMatch = cpuVisibleFaceCount === gpuVisibleFaceCount
  const hasQuadSignatureMatch =
    JSON.stringify(createQuadSignatures(cpuMesh.packedVertices)) ===
    JSON.stringify(createQuadSignatures(gpuMesh.packedVertices))
  const hasIndexPatternMatch =
    hasExpectedQuadIndexPattern(cpuMesh.indices, cpuFaceCount) &&
    hasExpectedQuadIndexPattern(gpuMesh.indices, gpuFaceCount)

  return {
    cpuFaceCount,
    cpuIndexCount,
    cpuVertexCount,
    cpuVisibleFaceCount,
    faceCountMatches: hasFaceCountMatch,
    gpuFaceCount,
    gpuIndexCount,
    gpuVertexCount,
    gpuVisibleFaceCount,
    indexCountMatches: hasIndexCountMatch,
    indexPatternMatches: hasIndexPatternMatch,
    matches:
      hasFaceCountMatch &&
      hasVertexCountMatch &&
      hasIndexCountMatch &&
      hasVisibleFaceCountMatch &&
      hasQuadSignatureMatch &&
      hasIndexPatternMatch,
    quadSignatureMatches: hasQuadSignatureMatch,
    vertexCountMatches: hasVertexCountMatch,
    visibleFaceCountMatches: hasVisibleFaceCountMatch,
  }
}
