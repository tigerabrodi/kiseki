import { describe, expect, it } from 'vitest'

import {
  buildGpuChunkOcclusionGraphData,
  countGpuOcclusionVisibleSlots,
  getGpuOcclusionOppositeFaceIndex,
  GPU_OCCLUSION_INVALID_SLOT,
  GPU_OCCLUSION_NEIGHBOR_SLOT_STRIDE,
  GPU_OCCLUSION_SLOT_METADATA_STRIDE,
} from './chunkOcclusionGraph.ts'

describe('chunkOcclusionGraph', () => {
  it('builds active slot metadata and cardinal neighbor slot indices', () => {
    const graph = buildGpuChunkOcclusionGraphData(
      [
        {
          coords: { x: 0, y: 0, z: 0 },
          meshSlotIndex: 3,
          voxelWordOffset: 96,
        },
        {
          coords: { x: 1, y: 0, z: 0 },
          meshSlotIndex: 7,
          voxelWordOffset: 128,
        },
        {
          coords: { x: 0, y: 1, z: 0 },
          meshSlotIndex: 9,
          voxelWordOffset: 256,
        },
      ],
      12
    )
    const originMetadataOffset = 3 * GPU_OCCLUSION_SLOT_METADATA_STRIDE
    const originNeighborOffset = 3 * GPU_OCCLUSION_NEIGHBOR_SLOT_STRIDE

    expect(graph.activeSlotCount).toBe(3)
    expect(graph.slotMetadata[originMetadataOffset]).toBe(1)
    expect(graph.slotMetadata[originMetadataOffset + 1]).toBe(96)
    expect(graph.neighborSlots[originNeighborOffset]).toBe(7)
    expect(graph.neighborSlots[originNeighborOffset + 1]).toBe(
      GPU_OCCLUSION_INVALID_SLOT
    )
    expect(graph.neighborSlots[originNeighborOffset + 2]).toBe(9)
  })

  it('maps every face to its opposite face', () => {
    expect(getGpuOcclusionOppositeFaceIndex(0)).toBe(1)
    expect(getGpuOcclusionOppositeFaceIndex(1)).toBe(0)
    expect(getGpuOcclusionOppositeFaceIndex(2)).toBe(3)
    expect(getGpuOcclusionOppositeFaceIndex(3)).toBe(2)
    expect(getGpuOcclusionOppositeFaceIndex(4)).toBe(5)
    expect(getGpuOcclusionOppositeFaceIndex(5)).toBe(4)
  })

  it('counts visible slots without reading padded visibility bits', () => {
    expect(
      countGpuOcclusionVisibleSlots(new Uint32Array([0b1011, 0xffffffff]), 34)
    ).toBe(5)
  })
})
