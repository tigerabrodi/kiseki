import * as THREE from 'three/webgpu'

import type { GpuChunkMeshHandle } from '../gpu/GpuChunkMesher.ts'
import { CHUNK_SIZE } from '../voxel/chunk.ts'

export type GpuChunkRenderMesh = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardNodeMaterial>
}

export function createGpuChunkRenderMesh(
  handle: GpuChunkMeshHandle,
  material: THREE.MeshStandardNodeMaterial
): GpuChunkRenderMesh {
  const renderBuffers = handle.renderBuffers

  if (renderBuffers === undefined) {
    throw new Error(`Missing renderer-backed mesh buffers for ${handle.label}`)
  }

  const geometry = new THREE.BufferGeometry()

  geometry.setAttribute('packedData', renderBuffers.packedDataAttribute)
  geometry.setIndex(renderBuffers.indexAttribute)
  geometry.setIndirect(
    renderBuffers.indirectAttribute,
    handle.indirectByteOffset
  )
  geometry.boundingBox = new THREE.Box3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE)
  )
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(
    new THREE.Sphere()
  )

  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = true

  return { mesh }
}
