import * as THREE from 'three/webgpu'
import { describe, expect, it } from 'vitest'

import { countVisibleChunkMeshes } from './countVisibleChunkMeshes.ts'

describe('countVisibleChunkMeshes', () => {
  it('counts only meshes that intersect the camera frustum', () => {
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
    camera.position.set(0, 0, 0)
    camera.lookAt(new THREE.Vector3(0, 0, -1))
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()

    const visibleMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    )
    visibleMesh.position.set(0, 0, -5)
    visibleMesh.geometry.computeBoundingSphere()
    visibleMesh.updateMatrixWorld()

    const culledMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    )
    culledMesh.position.set(0, 0, 5)
    culledMesh.geometry.computeBoundingSphere()
    culledMesh.updateMatrixWorld()

    expect(countVisibleChunkMeshes(camera, [visibleMesh, culledMesh])).toBe(1)
  })
})
