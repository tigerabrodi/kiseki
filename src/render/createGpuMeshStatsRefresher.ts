import { readGpuChunkMeshCounts } from '../gpu/GpuChunkMesher.ts'
import type { GpuChunkMeshCache } from '../gpu/GpuChunkMeshCache.ts'
import type { WorldChunkEntry } from '../world/World.ts'
import { chunkKey } from '../world/World.ts'

type GpuMeshStats = {
  drawCalls: number
  faceCount: number
  triangleCount: number
}

type CreateGpuMeshStatsRefresherOptions = {
  getChunkEntries: () => Array<WorldChunkEntry>
  getGpuChunkMeshCache: () => GpuChunkMeshCache | null
  getGpuDevice: () => GPUDevice | null
  onStats: (stats: GpuMeshStats) => void
  setChunkRenderable: (key: string, isRenderable: boolean) => void
}

export type GpuMeshStatsRefresher = {
  refresh: () => Promise<void>
}

export function createGpuMeshStatsRefresher(
  options: CreateGpuMeshStatsRefresherOptions
): GpuMeshStatsRefresher {
  let refreshToken = 0

  return {
    async refresh(): Promise<void> {
      const gpuDevice = options.getGpuDevice()
      const gpuChunkMeshCache = options.getGpuChunkMeshCache()

      if (gpuDevice === null || gpuChunkMeshCache === null) {
        return
      }

      const activeGpuDevice = gpuDevice
      const activeGpuChunkMeshCache = gpuChunkMeshCache
      const currentRefreshToken = ++refreshToken
      const meshCounts = await Promise.all(
        options.getChunkEntries().map(async (entry) => {
          const handle = activeGpuChunkMeshCache.getMesh(entry.coords)

          if (handle === undefined) {
            return null
          }

          return {
            counts: await readGpuChunkMeshCounts(activeGpuDevice, handle),
            key: chunkKey(entry.coords),
          }
        })
      )

      if (currentRefreshToken !== refreshToken) {
        return
      }

      let drawCalls = 0
      let faceCount = 0
      let triangleCount = 0

      for (const meshCount of meshCounts) {
        if (meshCount === null) {
          continue
        }

        const isRenderable = meshCount.counts.indexCount > 0

        faceCount += meshCount.counts.faceCount
        triangleCount += meshCount.counts.indexCount / 3
        drawCalls += isRenderable ? 1 : 0
        options.setChunkRenderable(meshCount.key, isRenderable)
      }

      options.onStats({
        drawCalls,
        faceCount,
        triangleCount,
      })
    },
  }
}
