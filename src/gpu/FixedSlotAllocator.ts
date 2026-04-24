export class FixedSlotAllocator {
  private readonly capacityValue: number
  private readonly freeSlots: Array<number>
  private readonly isAllocatedFlags: Array<boolean>

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError(
        `FixedSlotAllocator capacity must be a positive integer, got ${capacity}`
      )
    }

    this.capacityValue = capacity
    this.freeSlots = []
    this.isAllocatedFlags = Array.from({ length: capacity }, () => false)

    for (let slotIndex = capacity - 1; slotIndex >= 0; slotIndex -= 1) {
      this.freeSlots.push(slotIndex)
    }
  }

  allocate(): number {
    const slotIndex = this.freeSlots.pop()

    if (slotIndex === undefined) {
      throw new Error('FixedSlotAllocator is out of free slots')
    }

    this.isAllocatedFlags[slotIndex] = true

    return slotIndex
  }

  allocatedCount(): number {
    return this.capacityValue - this.freeSlots.length
  }

  availableCount(): number {
    return this.freeSlots.length
  }

  capacity(): number {
    return this.capacityValue
  }

  free(slotIndex: number): void {
    if (
      !Number.isInteger(slotIndex) ||
      slotIndex < 0 ||
      slotIndex >= this.capacityValue
    ) {
      throw new RangeError(
        `Slot index ${slotIndex} is outside allocator capacity ${this.capacityValue}`
      )
    }

    if (this.isAllocatedFlags[slotIndex] !== true) {
      throw new Error(
        `Cannot free slot ${slotIndex} because it is not currently allocated`
      )
    }

    this.isAllocatedFlags[slotIndex] = false
    this.freeSlots.push(slotIndex)
  }
}
