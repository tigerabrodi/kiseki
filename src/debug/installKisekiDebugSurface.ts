import * as THREE from 'three/webgpu'

import type { GpuPipelineInfo } from './buildGpuPipelineInfo.ts'
import type { GpuAllocationSnapshot } from '../gpu/buildGpuAllocationSnapshot.ts'
import type { ChunkMeshComparison } from '../mesh/compareChunkMeshes.ts'
import type { GpuMeshCompactionInfo } from '../gpu/GpuChunkMeshSlab.ts'
import type {
  ProfileReport,
  ProfileSessionState,
} from '../profiling/ProfileRecorder.ts'
import type { VoxelMaterialComparison } from '../voxel/compareVoxelMaterials.ts'
import type { ChunkStreamer } from '../world/ChunkStreamer.ts'
import type { ChunkCoordinates } from '../world/World.ts'

type KisekiDebugPosition = {
  x: number
  y: number
  z: number
}

export type KisekiDebugStats = {
  cpuTimeMs: number
  drawCalls: number
  editedVoxelCount: number
  faceCount: number
  fps: number
  gpuMeshBufferBytes: number
  gpuMeshBufferCount: number
  gpuVoxelBufferBytes: number
  gpuVoxelBufferCount: number
  gpuTimeMs: number | null
  loadedChunkCount: number
  meshGenerationTimeMs: number
  pipelineState: string
  playerChunk: ChunkCoordinates
  position: KisekiDebugPosition
  terrainGenerationTimeMs: number
  triangleCount: number
  vertexBytesPerVertex: number
  visibleChunkCount: number
}

export type KisekiMeshInfo = {
  attributeNames: Array<string>
  hasIndirect: boolean
  indirectOffset: number
  indexCount: number
  indexType: string | null
  materialType: string
  packedAttributeType: string | null
  vertexCount: number
} | null

export type KisekiSceneInfo = {
  backgroundType: string
  environmentName: string | null
  hasEnvironment: boolean
} | null

export type KisekiGpuTerrainInfo = {
  lastErrorMessage: string | null
} | null

export type KisekiGpuChunkInfo = {
  byteOffset: number
  byteLength: number
  coords: ChunkCoordinates
  isSlabAllocated: boolean
  label: string
  slotIndex: number
  voxelCount: number
} | null

export type KisekiGpuMeshInfo = {
  baseVertex: number
  countByteOffset: number
  coords: ChunkCoordinates
  countByteLength: number
  firstIndex: number
  indirectByteLength: number
  indirectByteOffset: number
  indexByteLength: number
  indexByteOffset: number
  isSlabAllocated: boolean
  label: string
  maxFaceCount: number
  maxIndexCount: number
  maxVertexCount: number
  slotIndex: number
  stagingIndexByteLength: number | null
  stagingIndexByteOffset: number | null
  stagingVertexByteLength: number | null
  stagingVertexByteOffset: number | null
  totalByteLength: number
  vertexByteLength: number
  vertexByteOffset: number
} | null

export type KisekiGpuMeshCompactionInfo = GpuMeshCompactionInfo | null
export type KisekiGpuAllocationInfo = GpuAllocationSnapshot | null

export type KisekiGpuPipelineInfo = GpuPipelineInfo | null

export type KisekiVoxelEditResult = {
  didEdit: boolean
  message: string
  touchedChunkCount: number
}

export type KisekiDebugSurface = {
  breakTargetBlock: () => Promise<KisekiVoxelEditResult>
  camera: THREE.PerspectiveCamera
  chunkStreamer: ChunkStreamer
  compareCpuAndGpuChunkMesh: (
    x: number,
    y: number,
    z: number
  ) => Promise<ChunkMeshComparison | null>
  compareCpuAndGpuChunkMaterials: (
    x: number,
    y: number,
    z: number
  ) => Promise<VoxelMaterialComparison | null>
  getGpuAllocationInfo: () => KisekiGpuAllocationInfo
  getGpuChunkInfo: (x: number, y: number, z: number) => KisekiGpuChunkInfo
  getGpuMeshCompactionInfo: () => KisekiGpuMeshCompactionInfo
  getGpuMeshInfo: (x: number, y: number, z: number) => KisekiGpuMeshInfo
  getGpuPipelineInfo: () => KisekiGpuPipelineInfo
  getGpuTerrainInfo: () => KisekiGpuTerrainInfo
  getMeshInfo: () => KisekiMeshInfo
  getProfileReport: () => ProfileReport | null
  getProfileState: () => ProfileSessionState
  getSceneInfo: () => KisekiSceneInfo
  getStats: () => KisekiDebugStats
  placeTargetBlock: () => Promise<KisekiVoxelEditResult>
  readGpuChunkMaterials: (
    x: number,
    y: number,
    z: number
  ) => Promise<Array<number> | null>
  setCameraPosition: (x: number, y: number, z: number) => void
  startProfileSession: () => void
  stopProfileSession: () => Promise<ProfileReport | null>
  syncWorld: () => void
  turnCamera: (yawDegrees: number, pitchDegrees?: number) => void
}

declare global {
  interface Window {
    __kiseki?: KisekiDebugSurface
  }
}

export function installKisekiDebugSurface(
  surface: KisekiDebugSurface
): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  window.__kiseki = surface

  return () => {
    if (window.__kiseki === surface) {
      delete window.__kiseki
    }
  }
}
