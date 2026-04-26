import * as THREE from 'three/webgpu'

import type { GpuChunkMeshCache } from '../gpu/GpuChunkMeshCache.ts'
import { GpuChunkMesher } from '../gpu/GpuChunkMesher.ts'
import type { GpuChunkVoxelCache } from '../gpu/GpuChunkVoxelCache.ts'
import { remeshGpuChunkAtCoords } from '../gpu/remeshGpuChunkAtCoords.ts'
import type { ChunkStreamUpdate } from '../world/ChunkStreamer.ts'
import { chunkKey, chunkOrigin, type ChunkCoordinates } from '../world/World.ts'
import { getChunkCoordsWithCardinalNeighbors } from '../world/worldVoxelCoordinates.ts'
import { createGpuChunkRenderMesh } from './createGpuChunkRenderMesh.ts'

type DisposableMesh = THREE.Mesh<
  THREE.BufferGeometry,
  THREE.Material | Array<THREE.Material>
>

type SyncStreamedGpuChunkMeshesOptions = {
  chunkMeshCache: GpuChunkMeshCache
  chunkMesher: GpuChunkMesher
  chunkMeshMap: Map<string, DisposableMesh>
  chunkMeshSlotMap: Map<number, DisposableMesh>
  gpuVoxelCache: GpuChunkVoxelCache
  getSdfSlotIndex?: (coords: ChunkCoordinates) => number | null
  material: THREE.MeshStandardNodeMaterial
  update: Pick<ChunkStreamUpdate, 'loaded' | 'unloaded'>
  worldGroup: THREE.Group
  worldHasChunk: (coords: ChunkCoordinates) => boolean
}

export type SyncStreamedGpuChunkMeshesResult = {
  chunkMeshes: Array<DisposableMesh>
  meshGenerationTimeMs: number
  remeshedChunkCount: number
}

function collectStreamAffectedChunkCoords(
  update: Pick<ChunkStreamUpdate, 'loaded' | 'unloaded'>
): Array<ChunkCoordinates> {
  const keys = new Set<string>()
  const affected: Array<ChunkCoordinates> = []

  for (const entry of [...update.loaded, ...update.unloaded]) {
    for (const coords of getChunkCoordsWithCardinalNeighbors(entry.coords)) {
      const key = chunkKey(coords)

      if (keys.has(key)) {
        continue
      }

      keys.add(key)
      affected.push(coords)
    }
  }

  return affected
}

function removeChunkRenderMesh(
  chunkMeshMap: Map<string, DisposableMesh>,
  worldGroup: THREE.Group,
  coords: ChunkCoordinates
): void {
  const key = chunkKey(coords)
  const mesh = chunkMeshMap.get(key)

  if (mesh === undefined) {
    return
  }

  worldGroup.remove(mesh)
  chunkMeshMap.delete(key)
}

function addChunkRenderMesh(
  chunkMeshMap: Map<string, DisposableMesh>,
  worldGroup: THREE.Group,
  chunkMeshCache: GpuChunkMeshCache,
  chunkMeshSlotMap: Map<number, DisposableMesh>,
  getSdfSlotIndex: ((coords: ChunkCoordinates) => number | null) | undefined,
  material: THREE.MeshStandardNodeMaterial,
  entry: ChunkStreamUpdate['loaded'][number]
): void {
  const key = chunkKey(entry.coords)

  if (chunkMeshMap.has(key)) {
    return
  }

  const chunkHandle = chunkMeshCache.getMesh(entry.coords)

  if (chunkHandle === undefined) {
    return
  }

  const pooledMesh = chunkMeshSlotMap.get(chunkHandle.slotIndex)
  const chunkMesh =
    pooledMesh === undefined
      ? createGpuChunkRenderMesh(chunkHandle, material).mesh
      : pooledMesh
  const origin = chunkOrigin(entry.coords)

  if (pooledMesh === undefined) {
    chunkMeshSlotMap.set(chunkHandle.slotIndex, chunkMesh)
  }

  chunkMesh.position.set(origin.x, origin.y, origin.z)
  chunkMesh.userData.chunkSlotIndex = chunkHandle.slotIndex
  chunkMesh.userData.sdfSlotIndex =
    getSdfSlotIndex?.(entry.coords) ?? chunkHandle.slotIndex
  chunkMesh.visible = true
  worldGroup.add(chunkMesh)
  chunkMeshMap.set(key, chunkMesh)
}

export function syncStreamedGpuChunkMeshes(
  options: SyncStreamedGpuChunkMeshesOptions
): SyncStreamedGpuChunkMeshesResult {
  const rebuildStartMs = performance.now()

  options.chunkMeshCache.sync(options.update)

  for (const entry of options.update.unloaded) {
    removeChunkRenderMesh(
      options.chunkMeshMap,
      options.worldGroup,
      entry.coords
    )
  }

  for (const entry of options.update.loaded) {
    addChunkRenderMesh(
      options.chunkMeshMap,
      options.worldGroup,
      options.chunkMeshCache,
      options.chunkMeshSlotMap,
      options.getSdfSlotIndex,
      options.material,
      entry
    )
  }

  let remeshedChunkCount = 0

  for (const coords of collectStreamAffectedChunkCoords(options.update)) {
    if (!options.worldHasChunk(coords)) {
      continue
    }

    if (
      remeshGpuChunkAtCoords(
        options.chunkMesher,
        options.chunkMeshCache,
        options.gpuVoxelCache,
        coords
      )
    ) {
      remeshedChunkCount += 1
    }
  }

  options.worldGroup.updateMatrixWorld(true)

  return {
    chunkMeshes: [...options.chunkMeshMap.values()],
    meshGenerationTimeMs: performance.now() - rebuildStartMs,
    remeshedChunkCount,
  }
}
