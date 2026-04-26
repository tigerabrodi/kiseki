import * as THREE from 'three/webgpu'
import {
  attribute,
  float,
  Fn,
  select,
  storage,
  texture as textureNode,
  transformNormalToView,
  uniform,
  uint,
  varyingProperty,
  vec2,
  vec3,
} from 'three/tsl'

import type { GpuChunkVisibilityMaterialState } from '../gpu/GpuChunkVisibilityCuller.ts'
import type { GpuLightMaterialState } from '../gpu/GpuLightSlab.ts'
import type { GpuSdfMaterialState } from '../gpu/GpuSdfSlab.ts'
import { GPU_LIGHT_MAX_LEVEL } from '../gpu/lightStorageCodec.ts'
import type { VoxelTextureAtlas } from './loadVoxelTextureAtlas.ts'
import {
  SDF_AO_MIN_FACTOR,
  SDF_AO_NEAR_SURFACE_DISTANCE,
  SDF_AO_SAMPLE_DISTANCE,
} from './sdfAmbientOcclusion.ts'
import {
  SDF_SOFT_SHADOW_DIRECTION,
  SDF_SOFT_SHADOW_FAR_SAMPLE_DISTANCE,
  SDF_SOFT_SHADOW_MIN_FACTOR,
  SDF_SOFT_SHADOW_NEAR_DISTANCE,
  SDF_SOFT_SHADOW_NEAR_SAMPLE_DISTANCE,
  SDF_SOFT_SHADOW_OPEN_DISTANCE,
} from './sdfSoftShadow.ts'
import { VOXEL_LIGHT_MIN_FACTOR } from './voxelLightShading.ts'

const COORDINATE_MASK = 0x1f
const MATERIAL_MASK = 0xff
const CHUNK_SIZE = 32
const Y_SHIFT = 5
const Z_SHIFT = 10
const NORMAL_DIRECTION_SHIFT = 15
const MATERIAL_SHIFT = 18
const X_OVERFLOW_SHIFT = 26
const Y_OVERFLOW_SHIFT = 27
const Z_OVERFLOW_SHIFT = 28
const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE

function getChunkSlotIndex(object: THREE.Object3D | null): number {
  const userData: unknown = object?.userData

  if (
    typeof userData !== 'object' ||
    userData === null ||
    !('chunkSlotIndex' in userData)
  ) {
    return 0
  }

  const chunkSlotIndex = (userData as { chunkSlotIndex?: unknown })
    .chunkSlotIndex

  return typeof chunkSlotIndex === 'number' ? chunkSlotIndex >>> 0 : 0
}

function getChunkSdfSlotIndex(object: THREE.Object3D | null): number {
  const userData: unknown = object?.userData

  if (
    typeof userData !== 'object' ||
    userData === null ||
    !('sdfSlotIndex' in userData)
  ) {
    return getChunkSlotIndex(object)
  }

  const sdfSlotIndex = (userData as { sdfSlotIndex?: unknown }).sdfSlotIndex

  return typeof sdfSlotIndex === 'number'
    ? sdfSlotIndex >>> 0
    : getChunkSlotIndex(object)
}

function getChunkLightSlotIndex(object: THREE.Object3D | null): number {
  const userData: unknown = object?.userData

  if (
    typeof userData !== 'object' ||
    userData === null ||
    !('lightSlotIndex' in userData)
  ) {
    return getChunkSlotIndex(object)
  }

  const lightSlotIndex = (userData as { lightSlotIndex?: unknown })
    .lightSlotIndex

  return typeof lightSlotIndex === 'number'
    ? lightSlotIndex >>> 0
    : getChunkSlotIndex(object)
}

export function createVoxelChunkMaterial(
  atlas: VoxelTextureAtlas,
  visibilityState?: GpuChunkVisibilityMaterialState,
  sdfState?: GpuSdfMaterialState,
  lightState?: GpuLightMaterialState
): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial()
  const packedVertex = attribute<'uint'>('packedData', 'uint')
  const x = packedVertex
    .bitAnd(uint(COORDINATE_MASK))
    .toFloat()
    .add(
      packedVertex
        .shiftRight(uint(X_OVERFLOW_SHIFT))
        .bitAnd(uint(1))
        .toFloat()
        .mul(CHUNK_SIZE)
    )
  const y = packedVertex
    .shiftRight(uint(Y_SHIFT))
    .bitAnd(uint(COORDINATE_MASK))
    .toFloat()
    .add(
      packedVertex
        .shiftRight(uint(Y_OVERFLOW_SHIFT))
        .bitAnd(uint(1))
        .toFloat()
        .mul(CHUNK_SIZE)
    )
  const z = packedVertex
    .shiftRight(uint(Z_SHIFT))
    .bitAnd(uint(COORDINATE_MASK))
    .toFloat()
    .add(
      packedVertex
        .shiftRight(uint(Z_OVERFLOW_SHIFT))
        .bitAnd(uint(1))
        .toFloat()
        .mul(CHUNK_SIZE)
    )
  const localPosition = vec3(x, y, z)
  const normalDirection = packedVertex
    .shiftRight(uint(NORMAL_DIRECTION_SHIFT))
    .bitAnd(uint(0x7))
  const materialLayer = packedVertex
    .shiftRight(uint(MATERIAL_SHIFT))
    .bitAnd(uint(MATERIAL_MASK))
  const surfaceUvVarying = varyingProperty('vec2', 'vVoxelSurfaceUv')
  const isPx = normalDirection.equal(uint(0))
  const isNx = normalDirection.equal(uint(1))
  const isPy = normalDirection.equal(uint(2))
  const isNy = normalDirection.equal(uint(3))
  const isPz = normalDirection.equal(uint(4))
  const surfaceUv = select(
    isPx,
    vec2(localPosition.z.negate(), localPosition.y),
    select(
      isNx,
      vec2(localPosition.z, localPosition.y),
      select(
        isPy,
        vec2(localPosition.x, localPosition.z.negate()),
        select(
          isNy,
          vec2(localPosition.x, localPosition.z),
          select(
            isPz,
            vec2(localPosition.x, localPosition.y),
            vec2(localPosition.x.negate(), localPosition.y)
          )
        )
      )
    )
  )
  const wrappedSurfaceUv = surfaceUvVarying.fract()
  const localNormal = select(
    isPx,
    vec3(1, 0, 0),
    select(
      isNx,
      vec3(-1, 0, 0),
      select(
        isPy,
        vec3(0, 1, 0),
        select(
          isNy,
          vec3(0, -1, 0),
          select(isPz, vec3(0, 0, 1), vec3(0, 0, -1))
        )
      )
    )
  )
  const tangent = select(
    isPx,
    vec3(0, 0, -1),
    select(
      isNx,
      vec3(0, 0, 1),
      select(isPy.or(isNy).or(isPz), vec3(1, 0, 0), vec3(-1, 0, 0))
    )
  )
  const bitangent = select(
    isPy,
    vec3(0, 0, -1),
    select(isNy, vec3(0, 0, 1), vec3(0, 1, 0))
  )

  const basecolorSample = textureNode(atlas.basecolor)
    .depth(materialLayer)
    .sample(wrappedSurfaceUv)
  const normalSample = textureNode(atlas.normal)
    .depth(materialLayer)
    .sample(wrappedSurfaceUv)
  const roughnessSample = textureNode(atlas.roughness)
    .depth(materialLayer)
    .sample(wrappedSurfaceUv)
  const metalnessSample = textureNode(atlas.metalness)
    .depth(materialLayer)
    .sample(wrappedSurfaceUv)
  const heightSample = textureNode(atlas.height)
    .depth(materialLayer)
    .sample(wrappedSurfaceUv)

  const tangentSpaceNormal = normalSample.rgb.mul(2).sub(1)
  const localSurfaceNormal = tangent
    .mul(tangentSpaceNormal.x)
    .add(bitangent.mul(tangentSpaceNormal.y))
    .add(localNormal.mul(tangentSpaceNormal.z))
    .normalize()
  const heightOcclusion = heightSample.r.mul(0.2).add(0.8)
  const chunkSlotIndexNode = uint(
    uniform(0).onObjectUpdate(({ object }) => getChunkSlotIndex(object))
  )
  const chunkSdfSlotIndexNode = uint(
    uniform(0).onObjectUpdate(({ object }) => getChunkSdfSlotIndex(object))
  )
  const chunkLightSlotIndexNode = uint(
    uniform(0).onObjectUpdate(({ object }) => getChunkLightSlotIndex(object))
  )
  const visibilityWordNode =
    visibilityState === undefined
      ? null
      : storage(
          visibilityState.visibilityAttribute,
          'uint',
          visibilityState.visibilityWordCount
        )
          .toReadOnly()
          .element(chunkSlotIndexNode.shiftRight(uint(5)))
  const isChunkVisible =
    visibilityWordNode === null
      ? null
      : visibilityWordNode
          .shiftRight(chunkSlotIndexNode.bitAnd(uint(31)))
          .bitAnd(uint(1))
          .equal(uint(1))
  const localCulledPosition =
    isChunkVisible === null
      ? localPosition
      : select(isChunkVisible, localPosition, vec3(0, -1000000, 0))
  const sdfValuesNode =
    sdfState === undefined
      ? null
      : storage(
          sdfState.sdfAttribute,
          'float',
          sdfState.valueCount
        ).toReadOnly()
  const lightValuesNode =
    lightState === undefined
      ? null
      : storage(
          lightState.lightAttribute,
          'uint',
          lightState.valueCount
        ).toReadOnly()
  const getLocalVoxelIndex = (samplePosition: THREE.Node<'vec3'>) => {
    const clampedPosition = samplePosition.clamp(0, CHUNK_SIZE - 1)
    const sampleX = clampedPosition.x.floor().toUint()
    const sampleY = clampedPosition.y.floor().toUint()
    const sampleZ = clampedPosition.z.floor().toUint()

    return sampleX
      .add(sampleY.mul(uint(CHUNK_SIZE)))
      .add(sampleZ.mul(uint(CHUNK_SIZE * CHUNK_SIZE)))
  }
  const sampleSdfDistance = (samplePosition: THREE.Node<'vec3'>) => {
    if (sdfValuesNode === null) {
      return float(SDF_AO_SAMPLE_DISTANCE)
    }

    const localIndex = getLocalVoxelIndex(samplePosition)
    const globalIndex = chunkSdfSlotIndexNode
      .mul(uint(CHUNK_VOLUME))
      .add(localIndex)

    return sdfValuesNode.element(globalIndex)
  }
  const sampleLightLevel = (samplePosition: THREE.Node<'vec3'>) => {
    if (lightValuesNode === null) {
      return uint(GPU_LIGHT_MAX_LEVEL)
    }

    const localIndex = getLocalVoxelIndex(samplePosition)
    const globalIndex = chunkLightSlotIndexNode
      .mul(uint(CHUNK_VOLUME))
      .add(localIndex)

    return lightValuesNode.element(globalIndex)
  }
  const sdfProbePosition = localPosition.add(
    localNormal.mul(SDF_AO_SAMPLE_DISTANCE)
  )
  const sdfProbeDistance = sampleSdfDistance(sdfProbePosition)
  const sdfAmbientOcclusion = sdfProbeDistance
    .abs()
    .sub(SDF_AO_NEAR_SURFACE_DISTANCE)
    .div(SDF_AO_SAMPLE_DISTANCE - SDF_AO_NEAR_SURFACE_DISTANCE)
    .clamp(0, 1)
    .mul(1 - SDF_AO_MIN_FACTOR)
    .add(SDF_AO_MIN_FACTOR)
  const softShadowDirection = vec3(
    SDF_SOFT_SHADOW_DIRECTION.x,
    SDF_SOFT_SHADOW_DIRECTION.y,
    SDF_SOFT_SHADOW_DIRECTION.z
  ).normalize()
  const nearShadowDistance = sampleSdfDistance(
    localPosition.add(
      softShadowDirection.mul(SDF_SOFT_SHADOW_NEAR_SAMPLE_DISTANCE)
    )
  )
  const farShadowDistance = sampleSdfDistance(
    localPosition.add(
      softShadowDirection.mul(SDF_SOFT_SHADOW_FAR_SAMPLE_DISTANCE)
    )
  )
  const sdfSoftShadow = nearShadowDistance
    .abs()
    .min(farShadowDistance.abs())
    .sub(SDF_SOFT_SHADOW_NEAR_DISTANCE)
    .div(SDF_SOFT_SHADOW_OPEN_DISTANCE - SDF_SOFT_SHADOW_NEAR_DISTANCE)
    .clamp(0, 1)
    .mul(1 - SDF_SOFT_SHADOW_MIN_FACTOR)
    .add(SDF_SOFT_SHADOW_MIN_FACTOR)
  const lightSamplePosition = localPosition.add(localNormal.mul(0.01))
  const voxelLightFactor = sampleLightLevel(lightSamplePosition)
    .toFloat()
    .div(GPU_LIGHT_MAX_LEVEL)
    .clamp(0, 1)
    .mul(1 - VOXEL_LIGHT_MIN_FACTOR)
    .add(VOXEL_LIGHT_MIN_FACTOR)

  material.positionNode = Fn(() => {
    surfaceUvVarying.assign(surfaceUv)

    return localCulledPosition
  })()
  material.colorNode = basecolorSample.rgb
    .mul(heightOcclusion)
    .mul(sdfAmbientOcclusion)
    .mul(sdfSoftShadow)
    .mul(voxelLightFactor)
  material.normalNode = transformNormalToView(localSurfaceNormal).normalize()
  material.roughnessNode = roughnessSample.r
    .mul(0.9)
    .add(heightSample.r.mul(0.1))
  material.metalnessNode = metalnessSample.r
  material.aoNode = heightSample.r
    .mul(0.35)
    .add(float(0.65))
    .mul(sdfAmbientOcclusion)
    .mul(sdfSoftShadow)

  return material
}
