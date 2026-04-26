import * as THREE from 'three/webgpu'

export const VOXEL_MATERIAL_DEBUG_MODES = [
  'final',
  'basecolor',
  'normal',
  'voxelLight',
  'sdfAo',
  'sdfShadow',
  'height',
] as const

export type VoxelMaterialDebugMode = (typeof VOXEL_MATERIAL_DEBUG_MODES)[number]

const MODE_IDS = {
  basecolor: 1,
  final: 0,
  height: 6,
  normal: 2,
  sdfAo: 4,
  sdfShadow: 5,
  voxelLight: 3,
} satisfies Record<VoxelMaterialDebugMode, number>

const MATERIAL_DEBUG_MODE_KEY = 'voxelMaterialDebugMode'

export function resolveVoxelMaterialDebugMode(
  value: unknown
): VoxelMaterialDebugMode {
  return typeof value === 'string' &&
    VOXEL_MATERIAL_DEBUG_MODES.includes(value as VoxelMaterialDebugMode)
    ? (value as VoxelMaterialDebugMode)
    : 'final'
}

function getFirstMaterial(
  material: THREE.Material | Array<THREE.Material> | undefined
): THREE.Material | null {
  if (material === undefined) {
    return null
  }

  return Array.isArray(material) ? (material[0] ?? null) : material
}

export function getVoxelMaterialDebugModeId(
  mode: VoxelMaterialDebugMode
): number {
  return MODE_IDS[mode]
}

export function readVoxelMaterialDebugMode(
  material: THREE.Material | null
): VoxelMaterialDebugMode {
  return resolveVoxelMaterialDebugMode(
    material?.userData[MATERIAL_DEBUG_MODE_KEY]
  )
}

export function setVoxelMaterialDebugMode(
  material: THREE.Material | null,
  mode: unknown
): VoxelMaterialDebugMode {
  const resolvedMode = resolveVoxelMaterialDebugMode(mode)

  if (material !== null) {
    material.userData[MATERIAL_DEBUG_MODE_KEY] = resolvedMode
  }

  return resolvedMode
}

export function getObjectVoxelMaterialDebugModeId(
  object: THREE.Object3D | null
): number {
  const objectAsMesh = object as THREE.Mesh<
    THREE.BufferGeometry,
    THREE.Material | Array<THREE.Material>
  > | null
  const material = getFirstMaterial(objectAsMesh?.material)

  return getVoxelMaterialDebugModeId(readVoxelMaterialDebugMode(material))
}
