import { CHUNK_SIZE } from '../voxel/chunk.ts'
import type { ChunkFaceDirection } from './buildChunkQuads.ts'

const COORDINATE_MASK = 0x1f
const DIRECTION_MASK = 0x7
const MATERIAL_MASK = 0xff

const Y_SHIFT = 5
const Z_SHIFT = 10
const NORMAL_DIRECTION_SHIFT = 15
const MATERIAL_SHIFT = 18

// Step 14 reserves AO/light bits for future shading data. We temporarily spend
// three of those reserved bits on chunk-edge overflow flags so 32-sized chunks
// still fit in a single Uint32 packed vertex.
const X_OVERFLOW_SHIFT = 26
const Y_OVERFLOW_SHIFT = 27
const Z_OVERFLOW_SHIFT = 28

export const CHUNK_FACE_DIRECTION_IDS = {
  nx: 1,
  ny: 3,
  nz: 5,
  px: 0,
  py: 2,
  pz: 4,
} as const

export type PackedFaceDirectionId =
  (typeof CHUNK_FACE_DIRECTION_IDS)[keyof typeof CHUNK_FACE_DIRECTION_IDS]

export type PackedVoxelVertex = {
  materialId: number
  normalDirection: PackedFaceDirectionId
  x: number
  y: number
  z: number
}

function assertCoordinate(axis: 'x' | 'y' | 'z', value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > CHUNK_SIZE) {
    throw new RangeError(
      `${axis} must be an integer between 0 and ${CHUNK_SIZE}, got ${value}`
    )
  }
}

function assertByteRange(label: string, value: number, max: number): void {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new RangeError(
      `${label} must be an integer between 0 and ${max}, got ${value}`
    )
  }
}

function readOverflowBit(value: number, shift: number): number {
  return ((value >>> shift) & 0x1) * CHUNK_SIZE
}

export function encodeChunkFaceDirection(
  direction: ChunkFaceDirection
): PackedFaceDirectionId {
  return CHUNK_FACE_DIRECTION_IDS[direction]
}

export function packVoxelVertex(vertex: PackedVoxelVertex): number {
  assertCoordinate('x', vertex.x)
  assertCoordinate('y', vertex.y)
  assertCoordinate('z', vertex.z)
  assertByteRange('normalDirection', vertex.normalDirection, DIRECTION_MASK)
  assertByteRange('materialId', vertex.materialId, MATERIAL_MASK)

  const xOverflow = vertex.x >>> 5
  const yOverflow = vertex.y >>> 5
  const zOverflow = vertex.z >>> 5

  return (
    (((vertex.x & COORDINATE_MASK) << 0) |
      ((vertex.y & COORDINATE_MASK) << Y_SHIFT) |
      ((vertex.z & COORDINATE_MASK) << Z_SHIFT) |
      (vertex.normalDirection << NORMAL_DIRECTION_SHIFT) |
      (vertex.materialId << MATERIAL_SHIFT) |
      (xOverflow << X_OVERFLOW_SHIFT) |
      (yOverflow << Y_OVERFLOW_SHIFT) |
      (zOverflow << Z_OVERFLOW_SHIFT)) >>>
    0
  )
}

export function unpackVoxelVertex(value: number): PackedVoxelVertex {
  return {
    materialId: (value >>> MATERIAL_SHIFT) & MATERIAL_MASK,
    normalDirection: ((value >>> NORMAL_DIRECTION_SHIFT) &
      DIRECTION_MASK) as PackedFaceDirectionId,
    x: (value & COORDINATE_MASK) + readOverflowBit(value, X_OVERFLOW_SHIFT),
    y:
      ((value >>> Y_SHIFT) & COORDINATE_MASK) +
      readOverflowBit(value, Y_OVERFLOW_SHIFT),
    z:
      ((value >>> Z_SHIFT) & COORDINATE_MASK) +
      readOverflowBit(value, Z_OVERFLOW_SHIFT),
  }
}
