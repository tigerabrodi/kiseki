import { CHUNK_SIZE, Chunk } from '../voxel/chunk.ts'
import type { ChunkNeighbors } from '../voxel/chunkNeighbors.ts'

const FACE_VERTEX_COUNT = 4
const FACE_INDEX_COUNT = 6
const POSITION_COMPONENTS = 3

type Vec3 = readonly [number, number, number]

type FaceDefinition = {
  corners: readonly [Vec3, Vec3, Vec3, Vec3]
  neighborOffset: Vec3
  normal: Vec3
}

const FACE_DEFINITIONS: ReadonlyArray<FaceDefinition> = [
  {
    neighborOffset: [1, 0, 0],
    normal: [1, 0, 0],
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
  },
  {
    neighborOffset: [-1, 0, 0],
    normal: [-1, 0, 0],
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
  },
  {
    neighborOffset: [0, 1, 0],
    normal: [0, 1, 0],
    corners: [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
  },
  {
    neighborOffset: [0, -1, 0],
    normal: [0, -1, 0],
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
  },
  {
    neighborOffset: [0, 0, 1],
    normal: [0, 0, 1],
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
  },
  {
    neighborOffset: [0, 0, -1],
    normal: [0, 0, -1],
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
  },
]

const MATERIAL_COLORS = new Map<number, Vec3>([
  [1, [101 / 255, 116 / 255, 138 / 255]],
  [2, [178 / 255, 111 / 255, 82 / 255]],
  [3, [108 / 255, 168 / 255, 108 / 255]],
  [4, [231 / 255, 201 / 255, 151 / 255]],
  [5, [110 / 255, 183 / 255, 1]],
])

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
}

function getColor(materialId: number): Vec3 {
  return MATERIAL_COLORS.get(materialId) ?? [1, 1, 1]
}

function isInBounds(x: number, y: number, z: number): boolean {
  return (
    x >= 0 &&
    x < CHUNK_SIZE &&
    y >= 0 &&
    y < CHUNK_SIZE &&
    z >= 0 &&
    z < CHUNK_SIZE
  )
}

function getMaterialId(
  chunk: Chunk,
  neighbors: ChunkNeighbors,
  x: number,
  y: number,
  z: number
): number {
  if (isInBounds(x, y, z)) {
    return chunk.get(x, y, z)
  }

  const isYInBounds = y >= 0 && y < CHUNK_SIZE
  const isZInBounds = z >= 0 && z < CHUNK_SIZE

  if (x < 0 && isYInBounds && isZInBounds) {
    return neighbors.nx?.get(CHUNK_SIZE - 1, y, z) ?? 0
  }

  if (x >= CHUNK_SIZE && isYInBounds && isZInBounds) {
    return neighbors.px?.get(0, y, z) ?? 0
  }

  const isXInBounds = x >= 0 && x < CHUNK_SIZE

  if (y < 0 && isXInBounds && isZInBounds) {
    return neighbors.ny?.get(x, CHUNK_SIZE - 1, z) ?? 0
  }

  if (y >= CHUNK_SIZE && isXInBounds && isZInBounds) {
    return neighbors.py?.get(x, 0, z) ?? 0
  }

  if (z < 0 && isXInBounds && isYInBounds) {
    return neighbors.nz?.get(x, y, CHUNK_SIZE - 1) ?? 0
  }

  if (z >= CHUNK_SIZE && isXInBounds && isYInBounds) {
    return neighbors.pz?.get(x, y, 0) ?? 0
  }

  return 0
}

function isSolid(
  chunk: Chunk,
  neighbors: ChunkNeighbors,
  x: number,
  y: number,
  z: number
): boolean {
  return getMaterialId(chunk, neighbors, x, y, z) !== 0
}

export function buildChunkGeometryData(
  chunk: Chunk,
  neighbors: ChunkNeighbors = {}
): ChunkGeometryData {
  let solidCount = 0
  let faceCount = 0

  for (const voxel of chunk.voxels) {
    if (voxel !== 0) {
      solidCount += 1
    }
  }

  for (let z = 0; z < CHUNK_SIZE; z += 1) {
    for (let y = 0; y < CHUNK_SIZE; y += 1) {
      for (let x = 0; x < CHUNK_SIZE; x += 1) {
        if (!isSolid(chunk, neighbors, x, y, z)) {
          continue
        }

        for (const face of FACE_DEFINITIONS) {
          const neighborX = x + face.neighborOffset[0]
          const neighborY = y + face.neighborOffset[1]
          const neighborZ = z + face.neighborOffset[2]

          if (!isSolid(chunk, neighbors, neighborX, neighborY, neighborZ)) {
            faceCount += 1
          }
        }
      }
    }
  }

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

  for (let z = 0; z < CHUNK_SIZE; z += 1) {
    for (let y = 0; y < CHUNK_SIZE; y += 1) {
      for (let x = 0; x < CHUNK_SIZE; x += 1) {
        const materialId = chunk.get(x, y, z)

        if (materialId === 0) {
          continue
        }

        const color = getColor(materialId)

        for (const face of FACE_DEFINITIONS) {
          const neighborX = x + face.neighborOffset[0]
          const neighborY = y + face.neighborOffset[1]
          const neighborZ = z + face.neighborOffset[2]

          if (isSolid(chunk, neighbors, neighborX, neighborY, neighborZ)) {
            continue
          }

          const baseVertex = vertexOffset

          for (const corner of face.corners) {
            positions[positionOffset] = x + corner[0]
            positions[positionOffset + 1] = y + corner[1]
            positions[positionOffset + 2] = z + corner[2]
            positionOffset += POSITION_COMPONENTS

            normals[normalOffset] = face.normal[0]
            normals[normalOffset + 1] = face.normal[1]
            normals[normalOffset + 2] = face.normal[2]
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
      }
    }
  }

  return {
    colors,
    faceCount,
    indexCount,
    indices,
    normals,
    positions,
    solidCount,
    triangleCount: indexCount / 3,
    vertexCount,
  }
}
