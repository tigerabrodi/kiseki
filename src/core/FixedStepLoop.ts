export type FixedStepFrame = {
  alpha: number
  fixedDeltaSeconds: number
  frameTimeSeconds: number
  steps: number
}

type FixedStepLoopOptions = {
  fixedDeltaSeconds?: number
  maxFrameTimeSeconds?: number
}

const EPSILON = 1e-9

export class FixedStepLoop {
  readonly fixedDeltaSeconds: number
  readonly maxFrameTimeSeconds: number

  private accumulatorSeconds = 0
  private previousTimeSeconds: number | null = null

  constructor(options: FixedStepLoopOptions = {}) {
    this.fixedDeltaSeconds = options.fixedDeltaSeconds ?? 1 / 60
    this.maxFrameTimeSeconds = options.maxFrameTimeSeconds ?? 0.25
  }

  advance(timestampSeconds: number): FixedStepFrame {
    if (this.previousTimeSeconds === null) {
      this.previousTimeSeconds = timestampSeconds

      return {
        alpha: 0,
        fixedDeltaSeconds: this.fixedDeltaSeconds,
        frameTimeSeconds: 0,
        steps: 0,
      }
    }

    const rawFrameTimeSeconds = timestampSeconds - this.previousTimeSeconds
    const clampedFrameTimeSeconds = Math.min(
      Math.max(rawFrameTimeSeconds, 0),
      this.maxFrameTimeSeconds
    )

    this.previousTimeSeconds = timestampSeconds
    this.accumulatorSeconds += clampedFrameTimeSeconds

    let steps = 0

    while (this.accumulatorSeconds + EPSILON >= this.fixedDeltaSeconds) {
      this.accumulatorSeconds -= this.fixedDeltaSeconds
      if (this.accumulatorSeconds < EPSILON) {
        this.accumulatorSeconds = 0
      }
      steps += 1
    }

    return {
      alpha: this.accumulatorSeconds / this.fixedDeltaSeconds,
      fixedDeltaSeconds: this.fixedDeltaSeconds,
      frameTimeSeconds: clampedFrameTimeSeconds,
      steps,
    }
  }

  reset(timestampSeconds?: number): void {
    this.accumulatorSeconds = 0
    this.previousTimeSeconds = timestampSeconds ?? null
  }
}
