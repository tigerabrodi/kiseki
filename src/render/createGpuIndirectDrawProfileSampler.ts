import type {
  GpuChunkIndirectDrawCuller,
  GpuIndirectDrawInfo,
} from '../gpu/GpuChunkIndirectDrawCuller.ts'
import type { ProfileRecorder } from '../profiling/ProfileRecorder.ts'

type CreateGpuIndirectDrawProfileSamplerOptions = {
  getCuller: () => GpuChunkIndirectDrawCuller | null
  recorder: ProfileRecorder
  refreshEveryFrames?: number
}

export type GpuIndirectDrawProfileSampler = {
  flush: () => Promise<void>
  readInfo: () => Promise<GpuIndirectDrawInfo | null>
  tick: () => void
}

export function createGpuIndirectDrawProfileSampler(
  options: CreateGpuIndirectDrawProfileSamplerOptions
): GpuIndirectDrawProfileSampler {
  const refreshInterval = options.refreshEveryFrames ?? 15
  let framesSinceResolve = 0
  let pendingResolve: Promise<void> | null = null

  const readAndRecord = async (): Promise<void> => {
    const culler = options.getCuller()

    if (culler === null) {
      return
    }

    options.recorder.recordIndirectDrawInfo(await culler.readDrawInfo())
  }

  const resolveIfNeeded = (force = false): void => {
    if (
      !options.recorder.isRecording() ||
      pendingResolve !== null ||
      (!force && framesSinceResolve < refreshInterval)
    ) {
      return
    }

    framesSinceResolve = 0
    pendingResolve = readAndRecord().finally(() => {
      pendingResolve = null
    })
  }

  return {
    async flush(): Promise<void> {
      if (pendingResolve !== null) {
        await pendingResolve
      }

      if (options.recorder.isRecording()) {
        await readAndRecord()
      }
    },
    async readInfo(): Promise<GpuIndirectDrawInfo | null> {
      const culler = options.getCuller()

      return (await culler?.readDrawInfo()) ?? null
    },
    tick(): void {
      framesSinceResolve += 1
      resolveIfNeeded()
    },
  }
}
