import * as THREE from 'three/webgpu'

type ChunkRenderSlotUserData = {
  chunkSlotIndex?: unknown
  lightSlotIndex?: unknown
  sdfSlotIndex?: unknown
}

type ChunkRenderSlotIndices = {
  chunkSlotIndex: number
  lightSlotIndex?: number | null
  sdfSlotIndex?: number | null
}

function getUserData(object: THREE.Object3D | null): ChunkRenderSlotUserData {
  return object?.userData ?? {}
}

function getNumericSlotIndex(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value >>> 0 : fallback
}

export function getChunkSlotIndex(object: THREE.Object3D | null): number {
  return getNumericSlotIndex(getUserData(object).chunkSlotIndex, 0)
}

export function getChunkLightSlotIndex(object: THREE.Object3D | null): number {
  const chunkSlotIndex = getChunkSlotIndex(object)

  return getNumericSlotIndex(getUserData(object).lightSlotIndex, chunkSlotIndex)
}

export function getChunkSdfSlotIndex(object: THREE.Object3D | null): number {
  const chunkSlotIndex = getChunkSlotIndex(object)

  return getNumericSlotIndex(getUserData(object).sdfSlotIndex, chunkSlotIndex)
}

export function setChunkRenderSlotIndices(
  object: THREE.Object3D,
  indices: ChunkRenderSlotIndices
): void {
  object.userData.chunkSlotIndex = indices.chunkSlotIndex
  object.userData.lightSlotIndex =
    indices.lightSlotIndex ?? indices.chunkSlotIndex
  object.userData.sdfSlotIndex = indices.sdfSlotIndex ?? indices.chunkSlotIndex
}
