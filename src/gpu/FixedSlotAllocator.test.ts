import { describe, expect, it } from 'vitest'

import { FixedSlotAllocator } from './FixedSlotAllocator.ts'

describe('FixedSlotAllocator', () => {
  it('allocates slots, frees them, and reuses freed indices', () => {
    const allocator = new FixedSlotAllocator(3)

    expect(allocator.allocate()).toBe(0)
    expect(allocator.allocate()).toBe(1)
    expect(allocator.allocatedCount()).toBe(2)
    expect(allocator.availableCount()).toBe(1)

    allocator.free(0)

    expect(allocator.allocatedCount()).toBe(1)
    expect(allocator.availableCount()).toBe(2)
    expect(allocator.allocate()).toBe(0)
  })

  it('throws when the allocator is exhausted', () => {
    const allocator = new FixedSlotAllocator(1)

    allocator.allocate()

    expect(() => allocator.allocate()).toThrowError(
      'FixedSlotAllocator is out of free slots'
    )
  })

  it('rejects freeing an out-of-range or already free slot', () => {
    const allocator = new FixedSlotAllocator(2)

    expect(() => allocator.free(1)).toThrowError(
      'Cannot free slot 1 because it is not currently allocated'
    )

    allocator.allocate()
    allocator.free(0)

    expect(() => allocator.free(0)).toThrowError(
      'Cannot free slot 0 because it is not currently allocated'
    )
    expect(() => allocator.free(3)).toThrowError(
      'Slot index 3 is outside allocator capacity 2'
    )
  })
})
