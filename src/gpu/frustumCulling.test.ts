import * as THREE from 'three/webgpu'
import { describe, expect, it } from 'vitest'

import {
  countVisibleChunkSlots,
  extractCameraFrustumPlanes,
  isChunkBoundsVisible,
} from './frustumCulling.ts'

function createReferenceFrustum(
  camera: THREE.PerspectiveCamera
): THREE.Frustum {
  const frustum = new THREE.Frustum()
  const projectionMatrix = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  )

  frustum.setFromProjectionMatrix(projectionMatrix)

  return frustum
}

describe('frustumCulling', () => {
  it('extracts normalized planes that match Three frustum box tests', () => {
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200)

    camera.position.set(0, 16, 24)
    camera.lookAt(0, 16, -64)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
    camera.updateWorldMatrix(true, false)

    const planes = extractCameraFrustumPlanes(camera)
    const frustum = createReferenceFrustum(camera)
    const chunkOrigins = [
      new THREE.Vector3(-16, 0, -80),
      new THREE.Vector3(0, 0, -48),
      new THREE.Vector3(48, 0, -48),
      new THREE.Vector3(0, 64, -48),
      new THREE.Vector3(-96, 0, -16),
    ]

    expect(planes).toHaveLength(24)

    for (let planeIndex = 0; planeIndex < 6; planeIndex += 1) {
      const planeLength = Math.hypot(
        planes[planeIndex * 4] ?? 0,
        planes[planeIndex * 4 + 1] ?? 0,
        planes[planeIndex * 4 + 2] ?? 0
      )

      expect(planeLength).toBeCloseTo(1, 5)
    }

    for (const origin of chunkOrigins) {
      const referenceBox = new THREE.Box3(
        origin.clone(),
        origin.clone().addScalar(32)
      )

      expect(isChunkBoundsVisible(planes, origin, 32)).toBe(
        frustum.intersectsBox(referenceBox)
      )
    }
  })

  it('counts visible chunk bits without over-reading padded words', () => {
    expect(
      countVisibleChunkSlots(
        new Uint32Array([0b1011, 0b11111111111111111111111111111111]),
        35
      )
    ).toBe(6)
  })
})
