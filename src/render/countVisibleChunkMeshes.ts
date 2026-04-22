import * as THREE from 'three/webgpu'

type ChunkMesh = THREE.Mesh<
  THREE.BufferGeometry,
  THREE.Material | Array<THREE.Material>
>

export function countVisibleChunkMeshes(
  camera: THREE.Camera,
  chunkMeshes: Array<ChunkMesh>
): number {
  const frustum = new THREE.Frustum()
  const projectionMatrix = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  )
  const worldSphere = new THREE.Sphere()
  let visibleChunkCount = 0

  frustum.setFromProjectionMatrix(projectionMatrix)

  for (const chunkMesh of chunkMeshes) {
    if (!chunkMesh.visible || chunkMesh.geometry.boundingSphere === null) {
      continue
    }

    worldSphere.copy(chunkMesh.geometry.boundingSphere)
    worldSphere.applyMatrix4(chunkMesh.matrixWorld)

    if (frustum.intersectsSphere(worldSphere)) {
      visibleChunkCount += 1
    }
  }

  return visibleChunkCount
}
