import { describe, expect, it } from 'vitest'

import { buildGpuAllocationSnapshot } from './buildGpuAllocationSnapshot.ts'

describe('buildGpuAllocationSnapshot', () => {
  it('totals mesh and voxel pool stats', () => {
    const snapshot = buildGpuAllocationSnapshot({
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

    expect(snapshot.totalBufferCount).toBe(7)
    expect(snapshot.totalReservedByteLength).toBe(24576)
    expect(snapshot.mesh?.highWaterCount).toBe(15)
    expect(snapshot.voxel?.allocationCount).toBe(18)
  })

  it('handles unavailable pools cleanly', () => {
    const snapshot = buildGpuAllocationSnapshot({
      mesh: null,
      voxel: null,
    })

    expect(snapshot).toEqual({
      mesh: null,
      totalBufferCount: 0,
      totalReservedByteLength: 0,
      voxel: null,
    })
  })
})
