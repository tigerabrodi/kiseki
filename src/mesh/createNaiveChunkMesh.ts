import * as THREE from 'three/webgpu'

import { CHUNK_SIZE, Chunk } from '../voxel/chunk.ts'

const MATERIAL_COLORS = new Map<number, number>([
  [1, 0x65748a],
  [2, 0xb26f52],
  [3, 0x6ca86c],
  [4, 0xe7c997],
  [5, 0x6eb7ff],
])

export type NaiveChunkMesh = {
  drawCalls: number
  group: THREE.Group
  solidCount: number
}

function getMaterial(materialId: number): THREE.MeshStandardMaterial {
  const color = MATERIAL_COLORS.get(materialId) ?? 0xffffff

  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    metalness: 0.08,
    roughness: 0.9,
  })
}

export function createNaiveChunkMesh(chunk: Chunk): NaiveChunkMesh {
  const group = new THREE.Group()
  const materials = new Map<number, THREE.MeshStandardMaterial>()

  let solidCount = 0

  for (let z = 0; z < CHUNK_SIZE; z += 1) {
    for (let y = 0; y < CHUNK_SIZE; y += 1) {
      for (let x = 0; x < CHUNK_SIZE; x += 1) {
        const materialId = chunk.get(x, y, z)

        if (materialId === 0) {
          continue
        }

        let material = materials.get(materialId)

        if (material === undefined) {
          material = getMaterial(materialId)
          materials.set(materialId, material)
        }

        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
        mesh.position.set(x + 0.5, y + 0.5, z + 0.5)
        group.add(mesh)
        solidCount += 1
      }
    }
  }

  return {
    drawCalls: solidCount,
    group,
    solidCount,
  }
}
