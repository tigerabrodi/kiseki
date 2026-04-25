import { GPU_CHUNK_MESH_INDIRECT_WORD_COUNT } from './GpuChunkMesher.ts'

export function countActiveIndirectDraws(
  indirectWords: Uint32Array,
  commandCount: number
): number {
  let activeDrawCount = 0

  for (let commandIndex = 0; commandIndex < commandCount; commandIndex += 1) {
    const wordOffset = commandIndex * GPU_CHUNK_MESH_INDIRECT_WORD_COUNT
    const indexCount = indirectWords[wordOffset] ?? 0
    const instanceCount = indirectWords[wordOffset + 1] ?? 0

    if (indexCount > 0 && instanceCount > 0) {
      activeDrawCount += 1
    }
  }

  return activeDrawCount
}
