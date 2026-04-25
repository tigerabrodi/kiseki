import * as THREE from 'three/webgpu'

import {
  installKisekiDebugSurface,
  type KisekiGpuAllocationInfo,
  type KisekiDebugStats,
  type KisekiGpuMeshCompactionInfo,
  type KisekiGpuIndirectDrawInfo,
  type KisekiGpuOcclusionInfo,
  type KisekiGpuPipelineInfo,
  type KisekiGpuVisibilityInfo,
  type KisekiMaterialGalleryInfo,
  type KisekiVoxelEditResult,
} from '../debug/installKisekiDebugSurface.ts'
import type { GpuChunkMeshCache } from '../gpu/GpuChunkMeshCache.ts'
import { getGpuChunkMeshInfo, readGpuChunkMesh } from '../gpu/GpuChunkMesher.ts'
import type { GpuChunkVoxelCache } from '../gpu/GpuChunkVoxelCache.ts'
import {
  getGpuVoxelBufferInfo,
  readGpuVoxelChunkMaterials,
} from '../gpu/GpuVoxelBuffer.ts'
import { buildChunkGeometryData } from '../mesh/buildChunkGeometryData.ts'
import { compareChunkMeshes } from '../mesh/compareChunkMeshes.ts'
import type {
  ProfileReport,
  ProfileSessionState,
} from '../profiling/ProfileRecorder.ts'
import { compareVoxelMaterials } from '../voxel/compareVoxelMaterials.ts'
import type { Chunk } from '../voxel/chunk.ts'
import type { ChunkStreamer } from '../world/ChunkStreamer.ts'
import type { ChunkCoordinates } from '../world/World.ts'
import { getSceneBackgroundType } from './debugWorldHelpers.ts'

type DisposableMesh = THREE.Mesh<
  THREE.BufferGeometry,
  THREE.Material | Array<THREE.Material>
>

type InstallDebugWorldSurfaceOptions = {
  breakTargetBlock: () => Promise<KisekiVoxelEditResult>
  buildPipelineInfo: () => KisekiGpuPipelineInfo
  buildStatsSnapshot: () => KisekiDebugStats
  camera: THREE.PerspectiveCamera
  chunkMeshes: () => Array<DisposableMesh>
  chunkStreamer: ChunkStreamer
  createReferenceChunk: (coords: ChunkCoordinates) => Chunk
  getGpuChunkMeshCache: () => GpuChunkMeshCache | null
  getGpuAllocationInfo: () => KisekiGpuAllocationInfo
  getGpuDevice: () => GPUDevice | null
  getGpuIndirectDrawInfo: () => Promise<KisekiGpuIndirectDrawInfo>
  getGpuMeshCompactionInfo: () => KisekiGpuMeshCompactionInfo
  getGpuOcclusionInfo: () => Promise<KisekiGpuOcclusionInfo>
  getGpuTerrainErrorMessage: () => string | null
  getGpuVisibilityInfo: () => Promise<KisekiGpuVisibilityInfo>
  getGpuVoxelCache: () => GpuChunkVoxelCache | null
  getHdrEnvironmentName: () => string | null
  getMaterialGalleryInfo: () => KisekiMaterialGalleryInfo
  getProfileReport: () => ProfileReport | null
  getProfileState: () => ProfileSessionState
  getScene: () => THREE.Scene
  placeTargetBlock: () => Promise<KisekiVoxelEditResult>
  setCameraPosition: (x: number, y: number, z: number) => void
  setMaterialGalleryVisible: (isVisible: boolean) => boolean
  startProfileSession: () => void
  stopProfileSession: () => Promise<ProfileReport | null>
  syncWorld: () => void
  turnCamera: (yawDegrees: number, pitchDegrees?: number) => void
}

export function installDebugWorldSurface(
  options: InstallDebugWorldSurfaceOptions
): () => void {
  return installKisekiDebugSurface({
    breakTargetBlock: options.breakTargetBlock,
    camera: options.camera,
    chunkStreamer: options.chunkStreamer,
    compareCpuAndGpuChunkMaterials: async (x: number, y: number, z: number) => {
      const gpuDevice = options.getGpuDevice()
      const voxelHandle = options.getGpuVoxelCache()?.getBuffer({ x, y, z })

      if (gpuDevice === null || voxelHandle === undefined) {
        return null
      }

      const cpuChunk = options.createReferenceChunk({ x, y, z })
      const gpuMaterials = await readGpuVoxelChunkMaterials(
        gpuDevice,
        voxelHandle
      )

      return compareVoxelMaterials(cpuChunk.voxels, gpuMaterials)
    },
    compareCpuAndGpuChunkMesh: async (x: number, y: number, z: number) => {
      const gpuDevice = options.getGpuDevice()
      const coords = { x, y, z }
      const meshHandle = options.getGpuChunkMeshCache()?.getMesh(coords)

      if (gpuDevice === null || meshHandle === undefined) {
        return null
      }

      const nxCoords = { x: coords.x - 1, y: coords.y, z: coords.z }
      const nyCoords = { x: coords.x, y: coords.y - 1, z: coords.z }
      const nzCoords = { x: coords.x, y: coords.y, z: coords.z - 1 }
      const pxCoords = { x: coords.x + 1, y: coords.y, z: coords.z }
      const pyCoords = { x: coords.x, y: coords.y + 1, z: coords.z }
      const pzCoords = { x: coords.x, y: coords.y, z: coords.z + 1 }
      const cpuMesh = buildChunkGeometryData(
        options.createReferenceChunk(coords),
        {
          nx: options.chunkStreamer.world.hasChunk(nxCoords)
            ? options.createReferenceChunk(nxCoords)
            : undefined,
          ny: options.chunkStreamer.world.hasChunk(nyCoords)
            ? options.createReferenceChunk(nyCoords)
            : undefined,
          nz: options.chunkStreamer.world.hasChunk(nzCoords)
            ? options.createReferenceChunk(nzCoords)
            : undefined,
          px: options.chunkStreamer.world.hasChunk(pxCoords)
            ? options.createReferenceChunk(pxCoords)
            : undefined,
          py: options.chunkStreamer.world.hasChunk(pyCoords)
            ? options.createReferenceChunk(pyCoords)
            : undefined,
          pz: options.chunkStreamer.world.hasChunk(pzCoords)
            ? options.createReferenceChunk(pzCoords)
            : undefined,
        }
      )
      const gpuMesh = await readGpuChunkMesh(gpuDevice, meshHandle)

      return compareChunkMeshes(cpuMesh, gpuMesh)
    },
    getGpuAllocationInfo: options.getGpuAllocationInfo,
    getGpuChunkInfo: (x: number, y: number, z: number) =>
      getGpuVoxelBufferInfo(
        { x, y, z },
        options.getGpuVoxelCache()?.getBuffer({ x, y, z })
      ),
    getGpuIndirectDrawInfo: options.getGpuIndirectDrawInfo,
    getGpuMeshCompactionInfo: options.getGpuMeshCompactionInfo,
    getGpuOcclusionInfo: options.getGpuOcclusionInfo,
    getGpuMeshInfo: (x: number, y: number, z: number) =>
      getGpuChunkMeshInfo(
        { x, y, z },
        options.getGpuChunkMeshCache()?.getMesh({ x, y, z })
      ),
    getGpuPipelineInfo: options.buildPipelineInfo,
    getGpuTerrainInfo: () => ({
      lastErrorMessage: options.getGpuTerrainErrorMessage(),
    }),
    getGpuVisibilityInfo: options.getGpuVisibilityInfo,
    getMaterialGalleryInfo: options.getMaterialGalleryInfo,
    getMeshInfo: () => {
      const firstMesh = options.chunkMeshes()[0]

      if (firstMesh === undefined) {
        return null
      }

      const indirectOffset = Array.isArray(firstMesh.geometry.indirectOffset)
        ? (firstMesh.geometry.indirectOffset[0] ?? 0)
        : firstMesh.geometry.indirectOffset

      return {
        attributeNames: Object.keys(firstMesh.geometry.attributes),
        frustumCulled: firstMesh.frustumCulled,
        hasIndirect: firstMesh.geometry.indirect !== null,
        indirectOffset,
        indexCount: firstMesh.geometry.index?.count ?? 0,
        indexType: firstMesh.geometry.index?.constructor.name ?? null,
        materialType: Array.isArray(firstMesh.material)
          ? 'ArrayMaterial'
          : firstMesh.material.type,
        packedAttributeType:
          firstMesh.geometry.attributes.packedData?.constructor.name ?? null,
        vertexCount: firstMesh.geometry.attributes.packedData?.count ?? 0,
      }
    },
    getProfileReport: options.getProfileReport,
    getProfileState: options.getProfileState,
    getSceneInfo: () => {
      const scene = options.getScene()

      return {
        backgroundType: getSceneBackgroundType(scene.background),
        environmentName: options.getHdrEnvironmentName(),
        hasEnvironment: scene.environment !== null,
      }
    },
    getStats: options.buildStatsSnapshot,
    placeTargetBlock: options.placeTargetBlock,
    readGpuChunkMaterials: async (x: number, y: number, z: number) => {
      const gpuDevice = options.getGpuDevice()
      const handle = options.getGpuVoxelCache()?.getBuffer({ x, y, z })

      if (gpuDevice === null || handle === undefined) {
        return null
      }

      return Array.from(await readGpuVoxelChunkMaterials(gpuDevice, handle))
    },
    setCameraPosition: options.setCameraPosition,
    setMaterialGalleryVisible: options.setMaterialGalleryVisible,
    startProfileSession: options.startProfileSession,
    stopProfileSession: options.stopProfileSession,
    syncWorld: options.syncWorld,
    turnCamera: options.turnCamera,
  })
}
