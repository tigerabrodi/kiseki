import { describe, expect, it } from 'vitest'

import { CHUNK_SIZE, Chunk } from '../voxel/chunk.ts'
import { buildChunkGeometryData } from './buildChunkGeometryData.ts'

function fillChunk(chunk: Chunk, materialId: number): void {
  for (let z = 0; z < CHUNK_SIZE; z += 1) {
    for (let y = 0; y < CHUNK_SIZE; y += 1) {
      for (let x = 0; x < CHUNK_SIZE; x += 1) {
        chunk.set(x, y, z, materialId)
      }
    }
  }
}

describe('buildChunkGeometryData', () => {
  it('returns empty geometry for an empty chunk', () => {
    const data = buildChunkGeometryData(new Chunk())

    expect(data.solidCount).toBe(0)
    expect(data.faceCount).toBe(0)
    expect(data.vertexCount).toBe(0)
    expect(data.indexCount).toBe(0)
    expect(data.positions).toHaveLength(0)
    expect(data.normals).toHaveLength(0)
    expect(data.colors).toHaveLength(0)
    expect(data.indices).toHaveLength(0)
  })

  it('builds 24 verts and 36 indices for one solid voxel', () => {
    const chunk = new Chunk()
    chunk.set(0, 0, 0, 1)

    const data = buildChunkGeometryData(chunk)

    expect(data.solidCount).toBe(1)
    expect(data.faceCount).toBe(6)
    expect(data.vertexCount).toBe(24)
    expect(data.indexCount).toBe(36)
    expect(data.triangleCount).toBe(12)
    expect(data.positions).toHaveLength(72)
    expect(data.normals).toHaveLength(72)
    expect(data.colors).toHaveLength(72)
    expect(data.indices).toHaveLength(36)
  })

  it('culls the shared face between two adjacent solid voxels', () => {
    const chunk = new Chunk()
    chunk.set(0, 0, 0, 1)
    chunk.set(1, 0, 0, 2)

    const data = buildChunkGeometryData(chunk)

    expect(data.solidCount).toBe(2)
    expect(data.faceCount).toBe(10)
    expect(data.vertexCount).toBe(40)
    expect(data.indexCount).toBe(60)
    expect(data.triangleCount).toBe(20)
  })

  it('culls shared boundary faces when a solid neighbor chunk is present', () => {
    const chunk = new Chunk()
    const pxNeighbor = new Chunk()

    fillChunk(chunk, 1)
    fillChunk(pxNeighbor, 1)

    const isolatedData = buildChunkGeometryData(chunk)
    const neighborAwareData = buildChunkGeometryData(chunk, {
      px: pxNeighbor,
    })

    expect(isolatedData.faceCount).toBe(6 * CHUNK_SIZE * CHUNK_SIZE)
    expect(neighborAwareData.faceCount).toBe(5 * CHUNK_SIZE * CHUNK_SIZE)
    expect(isolatedData.faceCount - neighborAwareData.faceCount).toBe(
      CHUNK_SIZE * CHUNK_SIZE
    )
  })
})
