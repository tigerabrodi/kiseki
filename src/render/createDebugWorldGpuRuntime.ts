import type { WebGPURenderer } from 'three/webgpu'
import type * as THREE from 'three/webgpu'

import { GpuChunkIndirectDrawCuller } from '../gpu/GpuChunkIndirectDrawCuller.ts'
import { GpuChunkMeshCache } from '../gpu/GpuChunkMeshCache.ts'
import { GpuChunkMesher } from '../gpu/GpuChunkMesher.ts'
import { GpuChunkMeshSlab } from '../gpu/GpuChunkMeshSlab.ts'
import { GpuChunkOcclusionCuller } from '../gpu/GpuChunkOcclusionCuller.ts'
import { GpuChunkSdfCache } from '../gpu/GpuChunkSdfCache.ts'
import { GpuChunkVisibilityCuller } from '../gpu/GpuChunkVisibilityCuller.ts'
import { GpuChunkVoxelCache } from '../gpu/GpuChunkVoxelCache.ts'
import { GpuSdfGenerator } from '../gpu/GpuSdfGenerator.ts'
import { GpuSdfSlab } from '../gpu/GpuSdfSlab.ts'
import { GpuTerrainGenerator } from '../gpu/GpuTerrainGenerator.ts'
import { getWebGpuDevice } from '../gpu/GpuVoxelBuffer.ts'
import { GpuVoxelSlab } from '../gpu/GpuVoxelSlab.ts'
import { chunkKey } from '../world/World.ts'
import { createVoxelChunkMaterial } from './createVoxelChunkMaterial.ts'
import {
  createVoxelMaterialGallery,
  type VoxelMaterialGallery,
} from './createVoxelMaterialGallery.ts'
import { loadHdrEnvironment } from './loadHdrEnvironment.ts'
import { loadVoxelTextureAtlas } from './loadVoxelTextureAtlas.ts'

export type DebugWorldGpuRuntime = {
  disposeHdrEnvironment: () => void
  gpuChunkIndirectDrawCuller: GpuChunkIndirectDrawCuller
  gpuChunkMesher: GpuChunkMesher
  gpuChunkMeshCache: GpuChunkMeshCache
  gpuChunkMeshSlab: GpuChunkMeshSlab
  gpuChunkOcclusionCuller: GpuChunkOcclusionCuller
  gpuChunkSdfCache: GpuChunkSdfCache
  gpuChunkVisibilityCuller: GpuChunkVisibilityCuller
  gpuDevice: GPUDevice
  gpuSdfGenerator: GpuSdfGenerator
  gpuSdfSlab: GpuSdfSlab
  gpuTerrainGenerator: GpuTerrainGenerator
  gpuVoxelCache: GpuChunkVoxelCache
  gpuVoxelSlab: GpuVoxelSlab
  hdrEnvironmentName: string
  voxelChunkMaterial: THREE.MeshStandardNodeMaterial
  voxelMaterialGallery: VoxelMaterialGallery
}

type CreateDebugWorldGpuRuntimeOptions = {
  maxRetainedChunkCount: number
  renderer: WebGPURenderer
  scene: THREE.Scene
}

export async function createDebugWorldGpuRuntime(
  options: CreateDebugWorldGpuRuntimeOptions
): Promise<DebugWorldGpuRuntime> {
  const gpuDevice = getWebGpuDevice(options.renderer)
  const gpuVoxelSlab = new GpuVoxelSlab(
    gpuDevice,
    options.maxRetainedChunkCount
  )
  const gpuVoxelCache = new GpuChunkVoxelCache(
    (entry) => gpuVoxelSlab.allocate(entry.coords),
    (handle) => gpuVoxelSlab.release(handle)
  )
  const gpuTerrainGenerator = new GpuTerrainGenerator(gpuDevice, {
    seed: 'kiseki',
  })
  const gpuSdfGenerator = new GpuSdfGenerator(gpuDevice)
  const gpuSdfSlab = new GpuSdfSlab(
    options.renderer,
    options.maxRetainedChunkCount
  )
  const gpuChunkMesher = new GpuChunkMesher(gpuDevice)
  const gpuChunkMeshSlab = new GpuChunkMeshSlab(
    options.renderer,
    options.maxRetainedChunkCount
  )
  const gpuChunkVisibilityCuller = new GpuChunkVisibilityCuller(
    options.renderer,
    options.maxRetainedChunkCount
  )
  const gpuChunkOcclusionCuller = new GpuChunkOcclusionCuller(
    gpuDevice,
    options.maxRetainedChunkCount
  )

  gpuChunkVisibilityCuller.setOcclusionState(gpuChunkOcclusionCuller.getState())

  const gpuChunkIndirectDrawCuller = new GpuChunkIndirectDrawCuller(
    gpuDevice,
    gpuChunkVisibilityCuller.getDrawState(),
    gpuChunkMeshSlab.getIndirectDrawState()
  )
  const gpuChunkMeshCache = new GpuChunkMeshCache(
    (entry) => {
      const handle = gpuChunkMeshSlab.allocate(entry.coords)

      gpuChunkVisibilityCuller.registerChunk(handle, entry.coords)

      return handle
    },
    (handle) => {
      gpuChunkVisibilityCuller.release(handle)
      gpuChunkMeshSlab.release(handle)
    }
  )
  const gpuChunkSdfCache = new GpuChunkSdfCache(
    (entry) => {
      const voxelHandle = gpuVoxelCache.getBuffer(entry.coords)

      if (voxelHandle === undefined) {
        throw new Error(
          `Missing GPU voxel buffer for SDF chunk ${chunkKey(entry.coords)}`
        )
      }

      return gpuSdfSlab.allocate(entry.coords, voxelHandle.slotIndex)
    },
    (handle) => gpuSdfSlab.release(handle)
  )
  const [atlas, hdrEnvironment] = await Promise.all([
    loadVoxelTextureAtlas(options.renderer),
    loadHdrEnvironment(options.renderer),
  ])
  const voxelChunkMaterial = createVoxelChunkMaterial(
    atlas,
    gpuChunkVisibilityCuller.getMaterialState(),
    gpuSdfSlab.getMaterialState()
  )
  const voxelMaterialGallery = createVoxelMaterialGallery(atlas)

  options.scene.add(voxelMaterialGallery.group)
  options.scene.background = hdrEnvironment.backgroundTexture
  options.scene.environment = hdrEnvironment.environmentTexture

  return {
    disposeHdrEnvironment: hdrEnvironment.dispose,
    gpuChunkIndirectDrawCuller,
    gpuChunkMesher,
    gpuChunkMeshCache,
    gpuChunkMeshSlab,
    gpuChunkOcclusionCuller,
    gpuChunkSdfCache,
    gpuChunkVisibilityCuller,
    gpuDevice,
    gpuSdfGenerator,
    gpuSdfSlab,
    gpuTerrainGenerator,
    gpuVoxelCache,
    gpuVoxelSlab,
    hdrEnvironmentName: hdrEnvironment.environmentName,
    voxelChunkMaterial,
    voxelMaterialGallery,
  }
}
