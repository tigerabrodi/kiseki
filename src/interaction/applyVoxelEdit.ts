import * as THREE from 'three/webgpu'

import type { GpuChunkMeshCache } from '../gpu/GpuChunkMeshCache.ts'
import { GpuChunkMesher } from '../gpu/GpuChunkMesher.ts'
import type { GpuChunkVoxelCache } from '../gpu/GpuChunkVoxelCache.ts'
import { writeGpuVoxelMaterial } from '../gpu/GpuVoxelBuffer.ts'
import { remeshGpuChunkAtCoords } from '../gpu/remeshGpuChunkAtCoords.ts'
import type { ChunkStreamer } from '../world/ChunkStreamer.ts'
import { chunkKey } from '../world/World.ts'
import { VoxelOverrideStore } from '../world/VoxelOverrideStore.ts'
import {
  getAffectedChunkCoordsForLocalVoxel,
  worldVoxelToChunkVoxel,
} from '../world/worldVoxelCoordinates.ts'
import { createLoadedGpuVoxelSnapshot } from './readLoadedGpuVoxelSnapshot.ts'
import { raycastVoxels, type VoxelRaycastHit } from './voxelRaycast.ts'

export type VoxelEditMode = 'break' | 'place'

export type VoxelEditResult = {
  didEdit: boolean
  message: string
  touchedChunks: Array<{ x: number; y: number; z: number }>
  touchedChunkCount: number
}

type ApplyVoxelEditOptions = {
  camera: THREE.PerspectiveCamera
  chunkStreamer: ChunkStreamer
  device: GPUDevice
  gpuChunkMeshCache: GpuChunkMeshCache
  gpuChunkMesher: GpuChunkMesher
  gpuVoxelCache: GpuChunkVoxelCache
  maxDistance?: number
  mode: VoxelEditMode
  overrideStore: VoxelOverrideStore
  placementMaterialId?: number
}

const DEFAULT_MAX_DISTANCE = 8
const DEFAULT_PLACEMENT_MATERIAL_ID = 5

function formatWorldVoxel(hit: VoxelRaycastHit, mode: VoxelEditMode): string {
  const target = mode === 'break' ? hit.hitVoxel : hit.placementVoxel

  return `${target.x},${target.y},${target.z}`
}

function getTargetMaterialId(
  mode: VoxelEditMode,
  placementMaterialId: number
): number {
  if (mode === 'break') {
    return 0
  }

  return placementMaterialId
}

function getTargetVoxel(
  hit: VoxelRaycastHit,
  mode: VoxelEditMode
): {
  x: number
  y: number
  z: number
} {
  if (mode === 'break') {
    return hit.hitVoxel
  }

  return hit.placementVoxel
}

export async function applyVoxelEdit(
  options: ApplyVoxelEditOptions
): Promise<VoxelEditResult> {
  const direction = options.camera.getWorldDirection(new THREE.Vector3())
  const snapshot = await createLoadedGpuVoxelSnapshot(
    options.device,
    options.chunkStreamer.world.entries(),
    (coords) => options.gpuVoxelCache.getBuffer(coords)
  )
  const hit = raycastVoxels(
    options.camera.position,
    direction,
    options.maxDistance ?? DEFAULT_MAX_DISTANCE,
    (coords) => snapshot.getMaterial(coords)
  )

  if (hit === null) {
    return {
      didEdit: false,
      message: 'No block in range',
      touchedChunks: [],
      touchedChunkCount: 0,
    }
  }

  const targetVoxel = getTargetVoxel(hit, options.mode)
  const targetMaterialId = getTargetMaterialId(
    options.mode,
    options.placementMaterialId ?? DEFAULT_PLACEMENT_MATERIAL_ID
  )

  if (options.mode === 'place' && snapshot.getMaterial(targetVoxel) !== 0) {
    return {
      didEdit: false,
      message: 'Placement space is occupied',
      touchedChunks: [],
      touchedChunkCount: 0,
    }
  }

  const { chunkCoords, localCoords } = worldVoxelToChunkVoxel(targetVoxel)
  const targetHandle = options.gpuVoxelCache.getBuffer(chunkCoords)

  if (targetHandle === undefined) {
    return {
      didEdit: false,
      message: `Chunk ${chunkKey(chunkCoords)} is not loaded`,
      touchedChunks: [],
      touchedChunkCount: 0,
    }
  }

  writeGpuVoxelMaterial(
    options.device,
    targetHandle,
    localCoords,
    targetMaterialId
  )
  options.overrideStore.setVoxel(targetVoxel, targetMaterialId)

  let touchedChunkCount = 0
  const touchedChunks = []

  for (const coords of getAffectedChunkCoordsForLocalVoxel(
    chunkCoords,
    localCoords
  )) {
    if (!options.chunkStreamer.world.hasChunk(coords)) {
      continue
    }

    if (
      remeshGpuChunkAtCoords(
        options.gpuChunkMesher,
        options.gpuChunkMeshCache,
        options.gpuVoxelCache,
        coords
      )
    ) {
      touchedChunkCount += 1
      touchedChunks.push(coords)
    }
  }

  return {
    didEdit: true,
    message: `${options.mode === 'break' ? 'Broke' : 'Placed'} ${formatWorldVoxel(
      hit,
      options.mode
    )}`,
    touchedChunks,
    touchedChunkCount,
  }
}
