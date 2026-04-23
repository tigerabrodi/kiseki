import * as THREE from 'three/webgpu'

import { Chunk } from '../voxel/chunk.ts'
import type { ChunkNeighbors } from '../voxel/chunkNeighbors.ts'
import { buildChunkGeometryData } from './buildChunkGeometryData.ts'

export type ChunkMesh = {
  drawCalls: number
  faceCount: number
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardNodeMaterial>
  solidCount: number
  triangleCount: number
}

export function createChunkMesh(
  chunk: Chunk,
  material: THREE.MeshStandardNodeMaterial,
  neighbors: ChunkNeighbors = {}
): ChunkMesh {
  const data = buildChunkGeometryData(chunk, neighbors)
  const geometry = new THREE.BufferGeometry()

  geometry.setAttribute(
    'packedData',
    new THREE.Uint32BufferAttribute(data.packedVertices, 1)
  )
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1))

  if (data.bounds !== null) {
    geometry.boundingBox = new THREE.Box3(
      new THREE.Vector3(...data.bounds.min),
      new THREE.Vector3(...data.bounds.max)
    )
    geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(
      new THREE.Sphere()
    )
  }

  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = true

  return {
    drawCalls: data.solidCount > 0 ? 1 : 0,
    faceCount: data.faceCount,
    mesh,
    solidCount: data.solidCount,
    triangleCount: data.triangleCount,
  }
}
