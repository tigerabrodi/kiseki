import {
  chunkKey,
  type ChunkCoordinates,
  type WorldChunkEntry,
} from '../world/World.ts'
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

  size(): number {
    return this.meshes.size
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) {
      this.destroyMesh(mesh)
    }

    this.meshes.clear()
  }

  rebuild(entries: Array<WorldChunkEntry>): void {
    this.dispose()

    for (const entry of entries) {
      this.meshes.set(chunkKey(entry.coords), this.createMesh(entry))
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
