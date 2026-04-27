export function readShouldTrackGpuTimestamps(): boolean {
  return new URLSearchParams(window.location.search).has('gpu-timestamps')
}
