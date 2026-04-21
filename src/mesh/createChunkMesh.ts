import * as THREE from 'three/webgpu'

import { Chunk } from '../voxel/chunk.ts'
import { buildChunkGeometryData } from './buildChunkGeometryData.ts'

export type ChunkMesh = {
  drawCalls: number
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
  solidCount: number
  triangleCount: number
}

export function createChunkMesh(chunk: Chunk): ChunkMesh {
  const data = buildChunkGeometryData(chunk)
  const geometry = new THREE.BufferGeometry()

  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(data.positions, 3)
  )
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3))
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1))

  if (data.vertexCount > 0) {
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
  }

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.08,
    roughness: 0.9,
  })

  return {
    drawCalls: data.solidCount > 0 ? 1 : 0,
    mesh: new THREE.Mesh(geometry, material),
    solidCount: data.solidCount,
    triangleCount: data.triangleCount,
  }
}
