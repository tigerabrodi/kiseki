import * as THREE from 'three/webgpu'
import {
  attribute,
  float,
  select,
  texture as textureNode,
  transformNormalToView,
  uint,
  vec2,
  vec3,
} from 'three/tsl'

import type { VoxelTextureAtlas } from './loadVoxelTextureAtlas.ts'

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

export function createVoxelChunkMaterial(
  atlas: VoxelTextureAtlas
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
    .toFloat()
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
    .sample(surfaceUv)
  const normalSample = textureNode(atlas.normal)
    .depth(materialLayer)
    .sample(surfaceUv)
  const roughnessSample = textureNode(atlas.roughness)
    .depth(materialLayer)
    .sample(surfaceUv)
  const metalnessSample = textureNode(atlas.metalness)
    .depth(materialLayer)
    .sample(surfaceUv)
  const heightSample = textureNode(atlas.height)
    .depth(materialLayer)
    .sample(surfaceUv)

  const tangentSpaceNormal = normalSample.rgb.mul(2).sub(1)
  const localSurfaceNormal = tangent
    .mul(tangentSpaceNormal.x)
    .add(bitangent.mul(tangentSpaceNormal.y))
    .add(localNormal.mul(tangentSpaceNormal.z))
    .normalize()
  const heightOcclusion = heightSample.r.mul(0.2).add(0.8)

  material.positionNode = localPosition
  material.colorNode = basecolorSample.rgb.mul(heightOcclusion)
  material.normalNode = transformNormalToView(localSurfaceNormal).normalize()
  material.roughnessNode = roughnessSample.r
    .mul(0.9)
    .add(heightSample.r.mul(0.1))
  material.metalnessNode = metalnessSample.r
  material.aoNode = heightSample.r.mul(0.35).add(float(0.65))

  return material
}
