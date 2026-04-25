import {
  chunkKey,
  type ChunkCoordinates,
  type WorldChunkEntry,
} from '../world/World.ts'
import type { ChunkStreamUpdate } from '../world/ChunkStreamer.ts'
import {
  type GpuChunkMeshHandle,
  destroyGpuChunkMeshHandle,
} from './GpuChunkMesher.ts'

type CreateGpuChunkMesh = (entry: WorldChunkEntry) => GpuChunkMeshHandle
type DestroyGpuChunkMesh = (handle: GpuChunkMeshHandle) => void

function getMeshByteLength(handle: GpuChunkMeshHandle): number {
  return (
    handle.countsByteLength +
    handle.indirectByteLength +
    handle.indexByteLength +
    handle.vertexByteLength
  )
}

export class GpuChunkMeshCache {
  private readonly createMesh: CreateGpuChunkMesh
  private readonly destroyMesh: DestroyGpuChunkMesh
  private readonly meshes = new Map<string, GpuChunkMeshHandle>()

  constructor(
    createMesh: CreateGpuChunkMesh,
    destroyMesh: DestroyGpuChunkMesh = destroyGpuChunkMeshHandle
  ) {
    this.createMesh = createMesh
    this.destroyMesh = destroyMesh
  }

  getMesh(coords: ChunkCoordinates): GpuChunkMeshHandle | undefined {
    return this.meshes.get(chunkKey(coords))
  }

  handles(): Array<GpuChunkMeshHandle> {
    return [...this.meshes.values()]
  }

  size(): number {
    return this.meshes.size
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) {
      this.destroyMesh(mesh)
    }

    this.meshes.clear()
  }

  sync(update: Pick<ChunkStreamUpdate, 'loaded' | 'unloaded'>): void {
    for (const entry of update.unloaded) {
      const key = chunkKey(entry.coords)
      const mesh = this.meshes.get(key)

      if (mesh === undefined) {
        continue
      }

      this.destroyMesh(mesh)
      this.meshes.delete(key)
    }

    for (const entry of update.loaded) {
      const key = chunkKey(entry.coords)

      if (this.meshes.has(key)) {
        continue
      }

      this.meshes.set(key, this.createMesh(entry))
    }
  }

  totalBytes(): number {
    let total = 0

    for (const mesh of this.meshes.values()) {
      total += getMeshByteLength(mesh)
    }

    return total
  }
}
