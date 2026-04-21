export const CHUNK_SIZE = 32
export const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE

type ChunkCoordinates = {
  x: number
  y: number
  z: number
}

function assertInBounds(axis: 'x' | 'y' | 'z', value: number): void {
  if (!Number.isInteger(value) || value < 0 || value >= CHUNK_SIZE) {
    throw new RangeError(
      `${axis} must be an integer between 0 and ${CHUNK_SIZE - 1}, got ${value}`,
    )
  }
}

function assertIndexInBounds(index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= CHUNK_VOLUME) {
    throw new RangeError(
      `index must be an integer between 0 and ${CHUNK_VOLUME - 1}, got ${index}`,
    )
  }
}

export function xyz2i(x: number, y: number, z: number): number {
  assertInBounds('x', x)
  assertInBounds('y', y)
  assertInBounds('z', z)

  return x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE
}

export function i2xyz(index: number): ChunkCoordinates {
  assertIndexInBounds(index)

  const z = Math.floor(index / (CHUNK_SIZE * CHUNK_SIZE))
  const remainder = index % (CHUNK_SIZE * CHUNK_SIZE)
  const y = Math.floor(remainder / CHUNK_SIZE)
  const x = remainder % CHUNK_SIZE

  return { x, y, z }
}

export class Chunk {
  readonly voxels = new Uint8Array(CHUNK_VOLUME)

  get(x: number, y: number, z: number): number {
    return this.voxels[xyz2i(x, y, z)] ?? 0
  }

  set(x: number, y: number, z: number, materialId: number): void {
    if (!Number.isInteger(materialId) || materialId < 0 || materialId > 0xff) {
      throw new RangeError(
        `materialId must be an integer between 0 and 255, got ${materialId}`,
      )
    }

    this.voxels[xyz2i(x, y, z)] = materialId
  }
}
