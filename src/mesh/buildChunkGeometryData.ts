import { resolveVoxelMaterialLayer } from '../materials/resolveVoxelMaterialLayer.ts'
import { Chunk } from '../voxel/chunk.ts'
import type { ChunkNeighbors } from '../voxel/chunkNeighbors.ts'
import { buildChunkQuads, type ChunkQuad } from './buildChunkQuads.ts'
import {
  encodeChunkFaceDirection,
  packVoxelVertex,
} from './packedVoxelVertex.ts'

const FACE_VERTEX_COUNT = 4
const FACE_INDEX_COUNT = 6

type Vec3 = readonly [number, number, number]

export type ChunkGeometryBounds = {
  max: Vec3
  min: Vec3
}

export type ChunkGeometryData = {
  bounds: ChunkGeometryBounds | null
  faceCount: number
  indexCount: number
  indices: Uint32Array
  packedVertices: Uint32Array
  solidCount: number
  triangleCount: number
  vertexCount: number
  visibleFaceCount: number
}

function getQuadCorners(quad: ChunkQuad): readonly [Vec3, Vec3, Vec3, Vec3] {
  switch (quad.direction) {
    case 'px':
      return [
        [quad.x + 1, quad.y, quad.z + quad.width],
        [quad.x + 1, quad.y, quad.z],
        [quad.x + 1, quad.y + quad.height, quad.z],
        [quad.x + 1, quad.y + quad.height, quad.z + quad.width],
      ]
    case 'nx':
      return [
        [quad.x, quad.y, quad.z],
        [quad.x, quad.y, quad.z + quad.width],
        [quad.x, quad.y + quad.height, quad.z + quad.width],
        [quad.x, quad.y + quad.height, quad.z],
      ]
    case 'py':
      return [
        [quad.x, quad.y + 1, quad.z + quad.height],
        [quad.x + quad.width, quad.y + 1, quad.z + quad.height],
        [quad.x + quad.width, quad.y + 1, quad.z],
        [quad.x, quad.y + 1, quad.z],
      ]
    case 'ny':
      return [
        [quad.x, quad.y, quad.z],
        [quad.x + quad.width, quad.y, quad.z],
        [quad.x + quad.width, quad.y, quad.z + quad.height],
        [quad.x, quad.y, quad.z + quad.height],
      ]
    case 'pz':
      return [
        [quad.x, quad.y, quad.z + 1],
        [quad.x + quad.width, quad.y, quad.z + 1],
        [quad.x + quad.width, quad.y + quad.height, quad.z + 1],
        [quad.x, quad.y + quad.height, quad.z + 1],
      ]
    case 'nz':
      return [
        [quad.x + quad.width, quad.y, quad.z],
        [quad.x, quad.y, quad.z],
        [quad.x, quad.y + quad.height, quad.z],
        [quad.x + quad.width, quad.y + quad.height, quad.z],
      ]
  }
}

export function buildChunkGeometryData(
  chunk: Chunk,
  neighbors: ChunkNeighbors = {}
): ChunkGeometryData {
  const quadData = buildChunkQuads(chunk, neighbors)
  const faceCount = quadData.quads.length
  const vertexCount = faceCount * FACE_VERTEX_COUNT
  const indexCount = faceCount * FACE_INDEX_COUNT

  const packedVertices = new Uint32Array(vertexCount)
  const indices = new Uint32Array(indexCount)

  let indexOffset = 0
  let vertexOffset = 0
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY

  for (const quad of quadData.quads) {
    const materialLayer = resolveVoxelMaterialLayer(
      quad.materialId,
      quad.direction
    )
    const normalDirection = encodeChunkFaceDirection(quad.direction)
    const corners = getQuadCorners(quad)
    const baseVertex = vertexOffset

    for (const corner of corners) {
      packedVertices[vertexOffset] = packVoxelVertex({
        materialId: materialLayer,
        normalDirection,
        x: corner[0],
        y: corner[1],
        z: corner[2],
      })

      minX = Math.min(minX, corner[0])
      minY = Math.min(minY, corner[1])
      minZ = Math.min(minZ, corner[2])
      maxX = Math.max(maxX, corner[0])
      maxY = Math.max(maxY, corner[1])
      maxZ = Math.max(maxZ, corner[2])
      vertexOffset += 1
    }

    indices[indexOffset] = baseVertex
    indices[indexOffset + 1] = baseVertex + 1
    indices[indexOffset + 2] = baseVertex + 2
    indices[indexOffset + 3] = baseVertex
    indices[indexOffset + 4] = baseVertex + 2
    indices[indexOffset + 5] = baseVertex + 3
    indexOffset += FACE_INDEX_COUNT
  }

  return {
    bounds:
      vertexCount > 0
        ? {
            max: [maxX, maxY, maxZ],
            min: [minX, minY, minZ],
          }
        : null,
    faceCount,
    indexCount,
    indices,
    packedVertices,
    solidCount: quadData.solidCount,
    triangleCount: indexCount / 3,
    vertexCount,
    visibleFaceCount: quadData.visibleFaceCount,
  }
}
