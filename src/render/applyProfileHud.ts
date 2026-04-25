import type {
  ProfileReport,
  ProfileSessionState,
} from '../profiling/ProfileRecorder.ts'
import { formatProfileReport } from '../profiling/ProfileRecorder.ts'

type ProfileHudElements = {
  copyProfileButton: HTMLButtonElement
  profileButton: HTMLButtonElement
  profileReportValue: HTMLElement
  profileStateValue: HTMLElement
}

export function applyProfileHud(
  elements: ProfileHudElements,
  profileState: ProfileSessionState
): void {
  let profileLabel = 'Ready'

  if (profileState.isRecording) {
    profileLabel = `Rec ${profileState.elapsedSeconds.toFixed(1)}s`
  } else if (profileState.lastReport === null) {
    profileLabel = 'Idle'
  }

  elements.profileStateValue.textContent = profileLabel
  elements.profileButton.textContent = profileState.isRecording
    ? 'Stop & Save Run'
    : 'Start Profile Run'
  elements.copyProfileButton.disabled =
    profileState.isRecording || profileState.lastReport === null

  elements.profileReportValue.textContent = getProfileReportText(
    profileState.isRecording,
    profileState.elapsedSeconds,
    profileState.lastReport
  )
}

function getProfileReportText(
  isRecording: boolean,
  elapsedSeconds: number,
  lastReport: ProfileReport | null
): string {
  if (isRecording) {
    return [
      'Recording GPU cull run...',
      `Elapsed: ${elapsedSeconds.toFixed(1)} s`,
      'Fly around, turn hard, and stream chunks so the GPU visibility mask has something to chew on.',
    ].join('\n')
  }

  if (lastReport !== null) {
    return formatProfileReport(lastReport)
  }

  return 'Press Start Profile Run, fly around for a bit, turn the camera quickly, then stop to capture a fresh GPU-culling run.'
}
