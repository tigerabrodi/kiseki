import { describe, expect, it } from 'vitest'

import { planGpuMeshCompaction } from './planGpuMeshCompaction.ts'

describe('planGpuMeshCompaction', () => {
  it('packs non-empty meshes contiguously in sort order', () => {
    const plan = planGpuMeshCompaction([
      {
        indexCount: 6,
        key: 'a',
        sortOrder: 20,
        vertexCount: 4,
      },
      {
        indexCount: 0,
        key: 'empty',
        sortOrder: 10,
        vertexCount: 0,
      },
      {
        indexCount: 12,
        key: 'b',
        sortOrder: 30,
        vertexCount: 8,
      },
    ])

    expect(plan.activeChunkCount).toBe(2)
    expect(plan.emptyChunkCount).toBe(1)
    expect(plan.activeVertexByteLength).toBe(
      (4 + 8) * Uint32Array.BYTES_PER_ELEMENT
    )
    expect(plan.activeIndexByteLength).toBe(
      (6 + 12) * Uint32Array.BYTES_PER_ELEMENT
    )
    expect(plan.assignments).toEqual([
      {
        baseVertex: 0,
        firstIndex: 0,
        indexByteLength: 24,
        indexByteOffset: 0,
        indexCount: 6,
        key: 'a',
        vertexByteLength: 16,
        vertexByteOffset: 0,
        vertexCount: 4,
      },
      {
        baseVertex: 4,
        firstIndex: 6,
        indexByteLength: 48,
        indexByteOffset: 24,
        indexCount: 12,
        key: 'b',
        vertexByteLength: 32,
        vertexByteOffset: 16,
        vertexCount: 8,
      },
    ])
  })

  it('treats partially empty entries as empty work', () => {
    const plan = planGpuMeshCompaction([
      {
        indexCount: 6,
        key: 'index-only',
        sortOrder: 0,
        vertexCount: 0,
      },
      {
        indexCount: 0,
        key: 'vertex-only',
        sortOrder: 1,
        vertexCount: 4,
      },
    ])

    expect(plan.assignments).toEqual([])
    expect(plan.activeChunkCount).toBe(0)
    expect(plan.emptyChunkCount).toBe(2)
    expect(plan.activeVertexByteLength).toBe(0)
    expect(plan.activeIndexByteLength).toBe(0)
  })
})
