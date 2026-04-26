import type * as THREE from 'three/webgpu'

import type { GpuChunkLightCache } from '../gpu/GpuChunkLightCache.ts'
import type { GpuChunkMeshCache } from '../gpu/GpuChunkMeshCache.ts'
import type { GpuChunkMesher } from '../gpu/GpuChunkMesher.ts'
import type { GpuChunkSdfCache } from '../gpu/GpuChunkSdfCache.ts'
import type { GpuChunkVoxelCache } from '../gpu/GpuChunkVoxelCache.ts'
import type { GpuLightGenerator } from '../gpu/GpuLightGenerator.ts'
import type { GpuSdfGenerator } from '../gpu/GpuSdfGenerator.ts'
import {
  applyVoxelEdit,
  type VoxelEditMode,
  type VoxelEditResult,
} from '../interaction/applyVoxelEdit.ts'
import type { ChunkStreamer } from '../world/ChunkStreamer.ts'
import type { VoxelOverrideStore } from '../world/VoxelOverrideStore.ts'
import { regenerateGpuLightChunks } from './syncStreamedGpuLightBuffers.ts'
import { regenerateGpuSdfChunks } from './syncStreamedGpuSdfBuffers.ts'

type PointerLockState = {
  isLocked: boolean
}

type CreateVoxelEditHandlerOptions = {
  camera: THREE.PerspectiveCamera
  chunkStreamer: ChunkStreamer
  controls: PointerLockState
  getGpuChunkLightCache: () => GpuChunkLightCache | null
  getGpuChunkMeshCache: () => GpuChunkMeshCache | null
  getGpuChunkMesher: () => GpuChunkMesher | null
  getGpuChunkSdfCache: () => GpuChunkSdfCache | null
  getGpuChunkVoxelCache: () => GpuChunkVoxelCache | null
  getGpuDevice: () => GPUDevice | null
  getGpuLightGenerator: () => GpuLightGenerator | null
  getGpuSdfGenerator: () => GpuSdfGenerator | null
  onAfterEditAttempt: () => void
  onWorldEdited: () => void
  overrideStore: VoxelOverrideStore
  statusValue: HTMLElement
}

const VOXEL_EDIT_NOT_READY_RESULT: VoxelEditResult = {
  didEdit: false,
  message: 'Pointer is unlocked or GPU world is not ready',
  touchedChunks: [],
  touchedChunkCount: 0,
}

export function createVoxelEditHandler(
  options: CreateVoxelEditHandlerOptions
): (
  mode: VoxelEditMode,
  requirePointerLock?: boolean
) => Promise<VoxelEditResult> {
  let isVoxelEditInFlight = false

  return async (
    mode: VoxelEditMode,
    requirePointerLock = true
  ): Promise<VoxelEditResult> => {
    const gpuDevice = options.getGpuDevice()
    const gpuChunkMesher = options.getGpuChunkMesher()
    const gpuChunkMeshCache = options.getGpuChunkMeshCache()
    const gpuVoxelCache = options.getGpuChunkVoxelCache()

    if (
      (requirePointerLock && !options.controls.isLocked) ||
      gpuDevice === null ||
      gpuChunkMesher === null ||
      gpuChunkMeshCache === null ||
      gpuVoxelCache === null ||
      isVoxelEditInFlight
    ) {
      return VOXEL_EDIT_NOT_READY_RESULT
    }

    isVoxelEditInFlight = true

    try {
      const result = await applyVoxelEdit({
        camera: options.camera,
        chunkStreamer: options.chunkStreamer,
        device: gpuDevice,
        gpuChunkMeshCache,
        gpuChunkMesher,
        gpuVoxelCache,
        mode,
        overrideStore: options.overrideStore,
      })

      options.statusValue.textContent = result.message

      if (result.didEdit) {
        regenerateGpuSdfChunks({
          chunkCoords: result.touchedChunks,
          gpuSdfCache: options.getGpuChunkSdfCache(),
          gpuSdfGenerator: options.getGpuSdfGenerator(),
          gpuVoxelCache,
        })
        regenerateGpuLightChunks({
          chunkCoords: result.touchedChunks,
          gpuLightCache: options.getGpuChunkLightCache(),
          gpuLightGenerator: options.getGpuLightGenerator(),
          gpuVoxelCache,
        })
        options.onWorldEdited()
      }

      return result
    } finally {
      isVoxelEditInFlight = false
      options.onAfterEditAttempt()
    }
  }
}
