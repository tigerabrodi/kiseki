import * as THREE from 'three/webgpu'

import type { TerrainGenerator } from '../world/TerrainGenerator.ts'

export function setupInitialCameraPose(
  camera: THREE.PerspectiveCamera,
  terrainGenerator: TerrainGenerator
): THREE.Vector3 {
  const spawnX = 16
  const spawnZ = 48
  const spawnSurfaceHeight = terrainGenerator.getSurfaceHeightAt(spawnX, spawnZ)
  const initialPosition = new THREE.Vector3(
    spawnX,
    spawnSurfaceHeight + 18,
    spawnZ
  )

  camera.position.copy(initialPosition)
  camera.lookAt(spawnX, spawnSurfaceHeight + 6, 0)
  camera.updateMatrixWorld()

  return initialPosition
}
