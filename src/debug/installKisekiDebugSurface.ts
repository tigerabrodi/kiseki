import * as THREE from 'three/webgpu'

import type { ChunkStreamer } from '../world/ChunkStreamer.ts'
import type { ChunkCoordinates } from '../world/World.ts'

type KisekiDebugPosition = {
  x: number
  y: number
  z: number
}

export type KisekiDebugStats = {
  drawCalls: number
  faceCount: number
  loadedChunkCount: number
  playerChunk: ChunkCoordinates
  position: KisekiDebugPosition
  visibleChunkCount: number
}

export type KisekiDebugSurface = {
  camera: THREE.PerspectiveCamera
  chunkStreamer: ChunkStreamer
  getStats: () => KisekiDebugStats
  setCameraPosition: (x: number, y: number, z: number) => void
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
