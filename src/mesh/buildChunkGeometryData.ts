import { Chunk } from '../voxel/chunk.ts'
import type { ChunkNeighbors } from '../voxel/chunkNeighbors.ts'
import {
  buildChunkQuads,
  type ChunkFaceDirection,
  type ChunkQuad,
} from './buildChunkQuads.ts'

const FACE_VERTEX_COUNT = 4
const FACE_INDEX_COUNT = 6
const POSITION_COMPONENTS = 3

type Vec3 = readonly [number, number, number]

const MATERIAL_COLORS = new Map<number, Vec3>([
  [1, [101 / 255, 116 / 255, 138 / 255]],
  [2, [178 / 255, 111 / 255, 82 / 255]],
  [3, [108 / 255, 168 / 255, 108 / 255]],
  [4, [231 / 255, 201 / 255, 151 / 255]],
  [5, [110 / 255, 183 / 255, 1]],
])

const FACE_NORMALS: Record<ChunkFaceDirection, Vec3> = {
  nx: [-1, 0, 0],
  ny: [0, -1, 0],
  nz: [0, 0, -1],
  px: [1, 0, 0],
  py: [0, 1, 0],
  pz: [0, 0, 1],
}

export type ChunkGeometryData = {
  colors: Float32Array
  faceCount: number
  indexCount: number
  indices: Uint32Array
  normals: Float32Array
  positions: Float32Array
  solidCount: number
  triangleCount: number
  vertexCount: number
  visibleFaceCount: number
}

function getColor(materialId: number): Vec3 {
  return MATERIAL_COLORS.get(materialId) ?? [1, 1, 1]
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

  const positions = new Float32Array(vertexCount * POSITION_COMPONENTS)
  const normals = new Float32Array(vertexCount * POSITION_COMPONENTS)
  const colors = new Float32Array(vertexCount * POSITION_COMPONENTS)
  const indices = new Uint32Array(indexCount)

  let positionOffset = 0
  let normalOffset = 0
  let colorOffset = 0
  let indexOffset = 0
  let vertexOffset = 0

  for (const quad of quadData.quads) {
    const color = getColor(quad.materialId)
    const normal = FACE_NORMALS[quad.direction]
    const corners = getQuadCorners(quad)
    const baseVertex = vertexOffset

    for (const corner of corners) {
      positions[positionOffset] = corner[0]
      positions[positionOffset + 1] = corner[1]
      positions[positionOffset + 2] = corner[2]
      positionOffset += POSITION_COMPONENTS

      normals[normalOffset] = normal[0]
      normals[normalOffset + 1] = normal[1]
      normals[normalOffset + 2] = normal[2]
      normalOffset += POSITION_COMPONENTS

      colors[colorOffset] = color[0]
      colors[colorOffset + 1] = color[1]
      colors[colorOffset + 2] = color[2]
      colorOffset += POSITION_COMPONENTS

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
    colors,
    faceCount,
    indexCount,
    indices,
    normals,
    positions,
    solidCount: quadData.solidCount,
    triangleCount: indexCount / 3,
    vertexCount,
    visibleFaceCount: quadData.visibleFaceCount,
  }
}
