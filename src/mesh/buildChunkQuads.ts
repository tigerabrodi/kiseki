import { CHUNK_SIZE, Chunk } from '../voxel/chunk.ts'
import type { ChunkNeighbors } from '../voxel/chunkNeighbors.ts'

type Vec3 = readonly [number, number, number]

export type ChunkFaceDirection = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz'

export type ChunkQuad = {
  direction: ChunkFaceDirection
  height: number
  materialId: number
  width: number
  x: number
  y: number
  z: number
}

export type ChunkQuadData = {
  quads: Array<ChunkQuad>
  solidCount: number
  visibleFaceCount: number
}

type FaceDefinition = {
  direction: ChunkFaceDirection
  getVoxelCoordinates: (
    slice: number,
    row: number,
    column: number
  ) => [number, number, number]
  neighborOffset: Vec3
}

const FACE_DEFINITIONS: ReadonlyArray<FaceDefinition> = [
  {
    direction: 'px',
    getVoxelCoordinates: (slice, row, column) => [slice, row, column],
    neighborOffset: [1, 0, 0],
  },
  {
    direction: 'nx',
    getVoxelCoordinates: (slice, row, column) => [slice, row, column],
    neighborOffset: [-1, 0, 0],
  },
  {
    direction: 'py',
    getVoxelCoordinates: (slice, row, column) => [column, slice, row],
    neighborOffset: [0, 1, 0],
  },
  {
    direction: 'ny',
    getVoxelCoordinates: (slice, row, column) => [column, slice, row],
    neighborOffset: [0, -1, 0],
  },
  {
    direction: 'pz',
    getVoxelCoordinates: (slice, row, column) => [column, row, slice],
    neighborOffset: [0, 0, 1],
  },
  {
    direction: 'nz',
    getVoxelCoordinates: (slice, row, column) => [column, row, slice],
    neighborOffset: [0, 0, -1],
  },
]

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

function countTrailingZeros(value: number): number {
  let bitIndex = 0
  let remainingBits = value >>> 0

  while ((remainingBits & 1) === 0) {
    remainingBits >>>= 1
    bitIndex += 1
  }

  return bitIndex
}

function createSpanMask(start: number, width: number): number {
  if (width === CHUNK_SIZE) {
    return 0xffffffff >>> 0
  }

  return (((1 << width) - 1) << start) >>> 0
}

function rowMatchesMaterial(
  materials: Uint8Array,
  row: number,
  startColumn: number,
  width: number,
  materialId: number
): boolean {
  const rowOffset = row * CHUNK_SIZE

  for (let columnOffset = 0; columnOffset < width; columnOffset += 1) {
    if (materials[rowOffset + startColumn + columnOffset] !== materialId) {
      return false
    }
  }

  return true
}

function buildFaceQuads(
  chunk: Chunk,
  neighbors: ChunkNeighbors,
  face: FaceDefinition
): { quads: Array<ChunkQuad>; visibleFaceCount: number } {
  const quads: Array<ChunkQuad> = []
  let visibleFaceCount = 0

  for (let slice = 0; slice < CHUNK_SIZE; slice += 1) {
    const rowMasks = new Uint32Array(CHUNK_SIZE)
    const materials = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE)

    for (let row = 0; row < CHUNK_SIZE; row += 1) {
      let rowMask = 0

      for (let column = 0; column < CHUNK_SIZE; column += 1) {
        const [x, y, z] = face.getVoxelCoordinates(slice, row, column)
        const materialId = chunk.get(x, y, z)

        if (materialId === 0) {
          continue
        }

        const neighborMaterialId = getMaterialId(
          chunk,
          neighbors,
          x + face.neighborOffset[0],
          y + face.neighborOffset[1],
          z + face.neighborOffset[2]
        )

        if (neighborMaterialId !== 0) {
          continue
        }

        rowMask |= (1 << column) >>> 0
        materials[row * CHUNK_SIZE + column] = materialId
        visibleFaceCount += 1
      }

      rowMasks[row] = rowMask >>> 0
    }

    for (let row = 0; row < CHUNK_SIZE; row += 1) {
      while (rowMasks[row] !== 0) {
        const startColumn = countTrailingZeros(rowMasks[row])
        const materialId = materials[row * CHUNK_SIZE + startColumn] ?? 0
        let width = 1

        while (startColumn + width < CHUNK_SIZE) {
          const nextBit = (1 << (startColumn + width)) >>> 0

          if ((rowMasks[row] & nextBit) === 0) {
            break
          }

          if (
            materials[row * CHUNK_SIZE + startColumn + width] !== materialId
          ) {
            break
          }

          width += 1
        }

        const spanMask = createSpanMask(startColumn, width)
        let height = 1

        while (row + height < CHUNK_SIZE) {
          if ((rowMasks[row + height] & spanMask) >>> 0 !== spanMask) {
            break
          }

          if (
            !rowMatchesMaterial(
              materials,
              row + height,
              startColumn,
              width,
              materialId
            )
          ) {
            break
          }

          height += 1
        }

        const [x, y, z] = face.getVoxelCoordinates(slice, row, startColumn)

        quads.push({
          direction: face.direction,
          height,
          materialId,
          width,
          x,
          y,
          z,
        })

        const clearMask = ~spanMask >>> 0

        for (let clearRow = row; clearRow < row + height; clearRow += 1) {
          rowMasks[clearRow] = (rowMasks[clearRow] & clearMask) >>> 0
        }
      }
    }
  }

  return {
    quads,
    visibleFaceCount,
  }
}

export function buildChunkQuads(
  chunk: Chunk,
  neighbors: ChunkNeighbors = {}
): ChunkQuadData {
  const quads: Array<ChunkQuad> = []
  let solidCount = 0
  let visibleFaceCount = 0

  for (const voxel of chunk.voxels) {
    if (voxel !== 0) {
      solidCount += 1
    }
  }

  for (const face of FACE_DEFINITIONS) {
    const faceData = buildFaceQuads(chunk, neighbors, face)

    quads.push(...faceData.quads)
    visibleFaceCount += faceData.visibleFaceCount
  }

  return {
    quads,
    solidCount,
    visibleFaceCount,
  }
}
