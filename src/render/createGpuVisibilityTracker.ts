import * as THREE from 'three/webgpu'

import type {
  GpuChunkVisibilityCuller,
  GpuChunkVisibilityInfo,
} from '../gpu/GpuChunkVisibilityCuller.ts'

type CreateGpuVisibilityTrackerOptions = {
  afterCull?: (forceRefresh: boolean) => void
  beforeCull?: () => void
  getCuller: () => GpuChunkVisibilityCuller | null
  onVisibilityInfoChange: () => void
  refreshEveryFrames?: number
}

export type GpuVisibilityTracker = {
  cull: (camera: THREE.Camera, forceRefresh?: boolean) => void
  getInfo: () => GpuChunkVisibilityInfo | null
  readInfo: () => Promise<GpuChunkVisibilityInfo | null>
}

export function createGpuVisibilityTracker(
  options: CreateGpuVisibilityTrackerOptions
): GpuVisibilityTracker {
  const refreshInterval = options.refreshEveryFrames ?? 10
  let lastVisibilityInfo: GpuChunkVisibilityInfo | null = null
  let pendingVisibilityResolve: Promise<void> | null = null
  let framesSinceVisibilityResolve = 0

  const resolveIfNeeded = (force = false): void => {
    const culler = options.getCuller()

    if (
      culler === null ||
      pendingVisibilityResolve !== null ||
      (!force && framesSinceVisibilityResolve < refreshInterval)
    ) {
      return
    }

    framesSinceVisibilityResolve = 0
    pendingVisibilityResolve = culler
      .readVisibilityInfo()
      .then((visibilityInfo) => {
        lastVisibilityInfo = visibilityInfo
      })
      .finally(() => {
        pendingVisibilityResolve = null
        options.onVisibilityInfoChange()
      })
  }

  return {
    cull(camera, forceRefresh = false): void {
      const culler = options.getCuller()

      if (culler === null) {
        return
      }

      options.beforeCull?.()
      culler.cull(camera)
      options.afterCull?.(forceRefresh)
      framesSinceVisibilityResolve += 1
      resolveIfNeeded(forceRefresh)
    },
    getInfo: () => lastVisibilityInfo,
    async readInfo(): Promise<GpuChunkVisibilityInfo | null> {
      const culler = options.getCuller()

      if (culler === null) {
        return null
      }

      const visibilityInfo = await culler.readVisibilityInfo()

      lastVisibilityInfo = visibilityInfo
      options.onVisibilityInfoChange()

      return visibilityInfo
    },
  }
}
