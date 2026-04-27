import * as THREE from 'three/webgpu'

import type { GpuChunkMeshCache } from '../gpu/GpuChunkMeshCache.ts'
import {
  GPU_CHUNK_MESH_COMPUTE_PASSES_PER_CHUNK,
  GpuChunkMesher,
} from '../gpu/GpuChunkMesher.ts'
import type { GpuChunkVoxelCache } from '../gpu/GpuChunkVoxelCache.ts'
import {
  encodeRemeshGpuChunksAtCoords,
  remeshGpuChunksAtCoords,
} from '../gpu/remeshGpuChunkAtCoords.ts'
import type { ChunkStreamUpdate } from '../world/ChunkStreamer.ts'
import { chunkKey, chunkOrigin, type ChunkCoordinates } from '../world/World.ts'
import { getChunkCoordsWithCardinalNeighbors } from '../world/worldVoxelCoordinates.ts'
import { setChunkRenderSlotIndices } from './chunkRenderSlotUserData.ts'
import { resetObjectChunkReveal } from './chunkReveal.ts'
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
  encoder?: GPUCommandEncoder
  extraRemeshChunkCoords?: Array<ChunkCoordinates>
  gpuVoxelCache: GpuChunkVoxelCache
  getLightSlotIndex?: (coords: ChunkCoordinates) => number | null
  getSdfSlotIndex?: (coords: ChunkCoordinates) => number | null
  includeNeighborRemeshes?: boolean
  material: THREE.MeshStandardNodeMaterial
  update: Pick<ChunkStreamUpdate, 'loaded' | 'unloaded'>
  worldGroup: THREE.Group
  worldHasChunk: (coords: ChunkCoordinates) => boolean
}

export type SyncStreamedGpuChunkMeshesResult = {
  chunkMeshes: Array<DisposableMesh>
  gpuComputePassCount: number
  gpuSubmissionCount: number
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

function collectChangedChunkCoords(
  update: Pick<ChunkStreamUpdate, 'loaded' | 'unloaded'>
): Array<ChunkCoordinates> {
  const keys = new Set<string>()
  const changed: Array<ChunkCoordinates> = []

  for (const entry of [...update.loaded, ...update.unloaded]) {
    const key = chunkKey(entry.coords)

    if (keys.has(key)) {
      continue
    }

    keys.add(key)
    changed.push(entry.coords)
  }

  return changed
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
  getLightSlotIndex: ((coords: ChunkCoordinates) => number | null) | undefined,
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

  resetObjectChunkReveal(chunkMesh)
  chunkMesh.position.set(origin.x, origin.y, origin.z)
  setChunkRenderSlotIndices(chunkMesh, {
    chunkSlotIndex: chunkHandle.slotIndex,
    lightSlotIndex: getLightSlotIndex?.(entry.coords),
    sdfSlotIndex: getSdfSlotIndex?.(entry.coords),
  })
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
      options.getLightSlotIndex,
      options.getSdfSlotIndex,
      options.material,
      entry
    )
  }

  const remeshKeys = new Set<string>()
  const remeshChunkCoords: Array<ChunkCoordinates> = []
  const streamRemeshChunkCoords =
    (options.includeNeighborRemeshes ?? true)
      ? collectStreamAffectedChunkCoords(options.update)
      : collectChangedChunkCoords(options.update)

  for (const coords of [
    ...streamRemeshChunkCoords,
    ...(options.extraRemeshChunkCoords ?? []),
  ]) {
    const key = chunkKey(coords)

    if (remeshKeys.has(key) || !options.worldHasChunk(coords)) {
      continue
    }

    remeshKeys.add(key)
    remeshChunkCoords.push(coords)
  }

  const remeshedChunkCount =
    options.encoder === undefined
      ? remeshGpuChunksAtCoords(
          options.chunkMesher,
          options.chunkMeshCache,
          options.gpuVoxelCache,
          remeshChunkCoords
        )
      : encodeRemeshGpuChunksAtCoords(
          options.encoder,
          options.chunkMesher,
          options.chunkMeshCache,
          options.gpuVoxelCache,
          remeshChunkCoords
        )

  options.worldGroup.updateMatrixWorld(true)

  return {
    chunkMeshes: [...options.chunkMeshMap.values()],
    gpuComputePassCount:
      remeshedChunkCount * GPU_CHUNK_MESH_COMPUTE_PASSES_PER_CHUNK,
    gpuSubmissionCount:
      options.encoder === undefined && remeshedChunkCount > 0 ? 1 : 0,
    meshGenerationTimeMs: performance.now() - rebuildStartMs,
    remeshedChunkCount,
  }
}
