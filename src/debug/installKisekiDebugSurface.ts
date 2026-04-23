import * as THREE from 'three/webgpu'

import type {
  ProfileReport,
  ProfileSessionState,
} from '../profiling/ProfileRecorder.ts'
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
  indexCount: number
  materialType: string
  vertexCount: number
} | null

export type KisekiSceneInfo = {
  backgroundType: string
  environmentName: string | null
  hasEnvironment: boolean
} | null

export type KisekiDebugSurface = {
  camera: THREE.PerspectiveCamera
  chunkStreamer: ChunkStreamer
  getMeshInfo: () => KisekiMeshInfo
  getProfileReport: () => ProfileReport | null
  getProfileState: () => ProfileSessionState
  getSceneInfo: () => KisekiSceneInfo
  getStats: () => KisekiDebugStats
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
