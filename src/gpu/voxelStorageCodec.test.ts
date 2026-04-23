import { describe, expect, it } from 'vitest'

import { CHUNK_VOLUME, Chunk } from '../voxel/chunk.ts'
import {
  decodeGpuVoxelData,
  encodeChunkVoxelsForGpu,
  GPU_VOXEL_BUFFER_BYTE_LENGTH,
  GPU_VOXEL_BYTES_PER_VOXEL,
} from './voxelStorageCodec.ts'

describe('voxelStorageCodec', () => {
  it('encodes chunk voxel bytes into GPU-friendly uint32 values', () => {
    const chunk = new Chunk()
    chunk.set(0, 0, 0, 7)
    chunk.set(31, 31, 31, 255)

    const encoded = encodeChunkVoxelsForGpu(chunk)

    expect(encoded).toBeInstanceOf(Uint32Array)
    expect(encoded).toHaveLength(CHUNK_VOLUME)
    expect(encoded[0]).toBe(7)
    expect(encoded[encoded.length - 1]).toBe(255)
    expect(encoded.byteLength).toBe(GPU_VOXEL_BUFFER_BYTE_LENGTH)
    expect(GPU_VOXEL_BUFFER_BYTE_LENGTH).toBe(
      CHUNK_VOLUME * GPU_VOXEL_BYTES_PER_VOXEL
    )
  })

  it('decodes GPU voxel data back into the original byte materials', () => {
    const encoded = new Uint32Array(CHUNK_VOLUME)
    encoded[0] = 4
    encoded[1] = 18
    encoded[encoded.length - 1] = 255

    const decoded = decodeGpuVoxelData(encoded)

    expect(decoded).toBeInstanceOf(Uint8Array)
    expect(decoded[0]).toBe(4)
    expect(decoded[1]).toBe(18)
    expect(decoded[decoded.length - 1]).toBe(255)
  })

  it('rejects readback buffers that do not match the chunk layout', () => {
    expect(() => decodeGpuVoxelData(new Uint32Array(CHUNK_VOLUME - 1))).toThrow(
      /Expected 32768 voxels/
    )

    const encoded = new Uint32Array(CHUNK_VOLUME)
    encoded[10] = 300

    expect(() => decodeGpuVoxelData(encoded)).toThrow(/between 0 and 255/)
  })
})
