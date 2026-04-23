import * as THREE from 'three/webgpu'

import type { ChunkMeshComparison } from '../mesh/compareChunkMeshes.ts'
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
  faceCount: number
  fps: number
  gpuMeshBufferBytes: number
  gpuMeshBufferCount: number
  gpuVoxelBufferBytes: number
  gpuVoxelBufferCount: number
  gpuTimeMs: number | null
  loadedChunkCount: number
  meshGenerationTimeMs: number
  playerChunk: ChunkCoordinates
  position: KisekiDebugPosition
  triangleCount: number
  vertexBytesPerVertex: number
  visibleChunkCount: number
}

export type KisekiMeshInfo = {
  attributeNames: Array<string>
  hasIndirect: boolean
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
  byteLength: number
  coords: ChunkCoordinates
  label: string
  voxelCount: number
} | null

export type KisekiGpuMeshInfo = {
  coords: ChunkCoordinates
  countByteLength: number
  indirectByteLength: number
  indexByteLength: number
  label: string
  maxFaceCount: number
  maxIndexCount: number
  maxVertexCount: number
  totalByteLength: number
  vertexByteLength: number
} | null

export type KisekiDebugSurface = {
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
  getGpuChunkInfo: (x: number, y: number, z: number) => KisekiGpuChunkInfo
  getGpuMeshInfo: (x: number, y: number, z: number) => KisekiGpuMeshInfo
  getGpuTerrainInfo: () => KisekiGpuTerrainInfo
  getMeshInfo: () => KisekiMeshInfo
  getProfileReport: () => ProfileReport | null
  getProfileState: () => ProfileSessionState
  getSceneInfo: () => KisekiSceneInfo
  getStats: () => KisekiDebugStats
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
