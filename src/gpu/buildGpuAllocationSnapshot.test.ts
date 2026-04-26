import { describe, expect, it } from 'vitest'

import { buildGpuAllocationSnapshot } from './buildGpuAllocationSnapshot.ts'

describe('buildGpuAllocationSnapshot', () => {
  it('totals mesh, voxel, SDF, and light pool stats', () => {
    const snapshot = buildGpuAllocationSnapshot({
      light: {
        activeByteLength: 4096,
        activeCount: 12,
        allocationCount: 20,
        availableCount: 88,
        bufferCount: 2,
        capacity: 100,
        highWaterCount: 15,
        releaseCount: 8,
        reservedByteLength: 32768,
      },
      mesh: {
        activeByteLength: 2048,
        activeCount: 12,
        allocationCount: 20,
        availableCount: 88,
        bufferCount: 6,
        capacity: 100,
        highWaterCount: 15,
        releaseCount: 8,
        reservedByteLength: 16384,
      },
      sdf: {
        activeByteLength: 1024,
        activeCount: 12,
        allocationCount: 19,
        availableCount: 88,
        bufferCount: 1,
        capacity: 100,
        highWaterCount: 14,
        releaseCount: 7,
        reservedByteLength: 4096,
      },
      voxel: {
        activeByteLength: 1024,
        activeCount: 12,
        allocationCount: 18,
        availableCount: 88,
        bufferCount: 1,
        capacity: 100,
        highWaterCount: 14,
        releaseCount: 6,
        reservedByteLength: 8192,
      },
    })

    expect(snapshot.totalBufferCount).toBe(10)
    expect(snapshot.totalReservedByteLength).toBe(61440)
    expect(snapshot.light?.bufferCount).toBe(2)
    expect(snapshot.mesh?.highWaterCount).toBe(15)
    expect(snapshot.sdf?.allocationCount).toBe(19)
    expect(snapshot.voxel?.allocationCount).toBe(18)
  })

  it('handles unavailable pools cleanly', () => {
    const snapshot = buildGpuAllocationSnapshot({
      mesh: null,
      voxel: null,
    })

    expect(snapshot).toEqual({
      light: null,
      mesh: null,
      sdf: null,
      totalBufferCount: 0,
      totalReservedByteLength: 0,
      voxel: null,
    })
  })
})
