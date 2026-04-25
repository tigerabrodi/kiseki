export type GpuMeshCompactionInput = {
  indexCount: number
  key: string
  sortOrder: number
  vertexCount: number
}

export type GpuMeshCompactionAssignment = {
  baseVertex: number
  firstIndex: number
  indexByteLength: number
  indexByteOffset: number
  indexCount: number
  key: string
  vertexByteLength: number
  vertexByteOffset: number
  vertexCount: number
}

export type GpuMeshCompactionPlan = {
  activeChunkCount: number
  activeIndexByteLength: number
  activeVertexByteLength: number
  assignments: Array<GpuMeshCompactionAssignment>
  emptyChunkCount: number
}

export function planGpuMeshCompaction(
  input: Array<GpuMeshCompactionInput>
): GpuMeshCompactionPlan {
  const assignments: Array<GpuMeshCompactionAssignment> = []
  let activeVertexByteLength = 0
  let activeIndexByteLength = 0
  let activeChunkCount = 0
  let emptyChunkCount = 0

  for (const entry of [...input].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (entry.vertexCount <= 0 || entry.indexCount <= 0) {
      emptyChunkCount += 1
      continue
    }

    const vertexByteLength = entry.vertexCount * Uint32Array.BYTES_PER_ELEMENT
    const indexByteLength = entry.indexCount * Uint32Array.BYTES_PER_ELEMENT

    assignments.push({
      baseVertex: activeVertexByteLength / Uint32Array.BYTES_PER_ELEMENT,
      firstIndex: activeIndexByteLength / Uint32Array.BYTES_PER_ELEMENT,
      indexByteLength,
      indexByteOffset: activeIndexByteLength,
      indexCount: entry.indexCount,
      key: entry.key,
      vertexByteLength,
      vertexByteOffset: activeVertexByteLength,
      vertexCount: entry.vertexCount,
    })

    activeChunkCount += 1
    activeVertexByteLength += vertexByteLength
    activeIndexByteLength += indexByteLength
  }

  return {
    activeChunkCount,
    activeIndexByteLength,
    activeVertexByteLength,
    assignments,
    emptyChunkCount,
  }
}
