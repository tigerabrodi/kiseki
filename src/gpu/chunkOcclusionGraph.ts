import { chunkKey, type ChunkCoordinates } from '../world/World.ts'

export const GPU_OCCLUSION_FACE_DIRECTIONS = [
  'px',
  'nx',
  'py',
  'ny',
  'pz',
  'nz',
] as const
export const GPU_OCCLUSION_FACE_COUNT = GPU_OCCLUSION_FACE_DIRECTIONS.length
export const GPU_OCCLUSION_INVALID_SLOT = 0xffffffff
export const GPU_OCCLUSION_NEIGHBOR_SLOT_STRIDE = 8
export const GPU_OCCLUSION_SLOT_METADATA_STRIDE = 4
export const GPU_OCCLUSION_FACE_MASK_STRIDE = 4
export const GPU_OCCLUSION_ALL_FACE_BITS = (1 << GPU_OCCLUSION_FACE_COUNT) - 1

export type GpuOcclusionFaceDirection =
  (typeof GPU_OCCLUSION_FACE_DIRECTIONS)[number]

export type GpuChunkOcclusionSlotInput = {
  coords: ChunkCoordinates
  meshSlotIndex: number
  voxelWordOffset: number
}

export type GpuChunkOcclusionGraphData = {
  activeSlotCount: number
  neighborSlots: Uint32Array
  slotMetadata: Uint32Array
}

const DIRECTION_OFFSETS = {
  nx: { x: -1, y: 0, z: 0 },
  ny: { x: 0, y: -1, z: 0 },
  nz: { x: 0, y: 0, z: -1 },
  px: { x: 1, y: 0, z: 0 },
  py: { x: 0, y: 1, z: 0 },
  pz: { x: 0, y: 0, z: 1 },
} as const satisfies Record<GpuOcclusionFaceDirection, ChunkCoordinates>

export function getGpuOcclusionOppositeFaceIndex(faceIndex: number): number {
  switch (faceIndex) {
    case 0:
      return 1
    case 1:
      return 0
    case 2:
      return 3
    case 3:
      return 2
    case 4:
      return 5
    case 5:
      return 4
    default:
      throw new RangeError(`Invalid occlusion face index ${faceIndex}`)
  }
}

export function countGpuOcclusionVisibleSlots(
  visibilityWords: Uint32Array,
  slotCount: number
): number {
  let visibleSlotCount = 0

  for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
    const word = visibilityWords[slotIndex >>> 5] ?? 0

    if (((word >>> (slotIndex & 31)) & 1) === 1) {
      visibleSlotCount += 1
    }
  }

  return visibleSlotCount
}

function assertValidSlot(slotIndex: number, capacity: number): void {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= capacity) {
    throw new RangeError(
      `Occlusion slot index must be an integer between 0 and ${
        capacity - 1
      }, got ${slotIndex}`
    )
  }
}

function getNeighborCoords(
  coords: ChunkCoordinates,
  direction: GpuOcclusionFaceDirection
): ChunkCoordinates {
  const offset = DIRECTION_OFFSETS[direction]

  return {
    x: coords.x + offset.x,
    y: coords.y + offset.y,
    z: coords.z + offset.z,
  }
}

export function buildGpuChunkOcclusionGraphData(
  inputs: Array<GpuChunkOcclusionSlotInput>,
  capacity: number
): GpuChunkOcclusionGraphData {
  const slotMetadata = new Uint32Array(
    capacity * GPU_OCCLUSION_SLOT_METADATA_STRIDE
  )
  const neighborSlots = new Uint32Array(
    capacity * GPU_OCCLUSION_NEIGHBOR_SLOT_STRIDE
  )
  const slotByChunkKey = new Map<string, number>()

  neighborSlots.fill(GPU_OCCLUSION_INVALID_SLOT)

  for (const input of inputs) {
    assertValidSlot(input.meshSlotIndex, capacity)
    slotByChunkKey.set(chunkKey(input.coords), input.meshSlotIndex)
  }

  for (const input of inputs) {
    const metadataOffset =
      input.meshSlotIndex * GPU_OCCLUSION_SLOT_METADATA_STRIDE
    const neighborOffset =
      input.meshSlotIndex * GPU_OCCLUSION_NEIGHBOR_SLOT_STRIDE

    slotMetadata[metadataOffset] = 1
    slotMetadata[metadataOffset + 1] = input.voxelWordOffset >>> 0

    for (const [
      faceIndex,
      direction,
    ] of GPU_OCCLUSION_FACE_DIRECTIONS.entries()) {
      neighborSlots[neighborOffset + faceIndex] =
        slotByChunkKey.get(
          chunkKey(getNeighborCoords(input.coords, direction))
        ) ?? GPU_OCCLUSION_INVALID_SLOT
    }
  }

  return {
    activeSlotCount: inputs.length,
    neighborSlots,
    slotMetadata,
  }
}
