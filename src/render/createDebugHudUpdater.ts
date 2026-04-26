import type { KisekiDebugStats } from '../debug/installKisekiDebugSurface.ts'
import type { ProfileRecorder } from '../profiling/ProfileRecorder.ts'
import { applyDebugStatsHud } from './applyDebugStatsHud.ts'
import { applyProfileHud } from './applyProfileHud.ts'
import type { DebugWorldElements } from './getDebugWorldElements.ts'

type CreateDebugHudUpdaterOptions = {
  buildStatsSnapshot: () => KisekiDebugStats
  elements: DebugWorldElements
  profileRecorder: ProfileRecorder
  updateIntervalMs?: number
}

export type DebugHudUpdater = (nowMs?: number, forceUpdate?: boolean) => void

export function createDebugHudUpdater(
  options: CreateDebugHudUpdaterOptions
): DebugHudUpdater {
  const updateIntervalMs = options.updateIntervalMs ?? 100
  let lastHudUpdateMs = Number.NEGATIVE_INFINITY

  return (nowMs = performance.now(), forceUpdate = false): void => {
    if (!forceUpdate && nowMs - lastHudUpdateMs < updateIntervalMs) {
      return
    }

    lastHudUpdateMs = nowMs

    applyDebugStatsHud(options.elements, options.buildStatsSnapshot())
    applyProfileHud(
      options.elements,
      options.profileRecorder.getSessionState(nowMs)
    )
  }
}
