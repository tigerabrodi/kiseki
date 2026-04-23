export type DebugWorldElements = {
  chunkCountValue: HTMLElement
  copyProfileButton: HTMLButtonElement
  cpuTimeValue: HTMLElement
  drawCallsValue: HTMLElement
  faceCountValue: HTMLElement
  fixedRateValue: HTMLElement
  fpsValue: HTMLElement
  gpuMeshCountValue: HTMLElement
  gpuMeshMegabytesValue: HTMLElement
  gpuTimeValue: HTMLElement
  gpuVoxelCountValue: HTMLElement
  gpuVoxelMegabytesValue: HTMLElement
  lockButton: HTMLButtonElement
  meshTimeValue: HTMLElement
  playerChunkValue: HTMLElement
  pointerStateValue: HTMLElement
  positionValue: HTMLElement
  profileButton: HTMLButtonElement
  profileReportValue: HTMLElement
  profileStateValue: HTMLElement
  statusValue: HTMLElement
  triangleCountValue: HTMLElement
  vertexBytesValue: HTMLElement
  viewport: HTMLElement
  visibleChunksValue: HTMLElement
}

export function getDebugWorldElements(root: HTMLElement): DebugWorldElements {
  const viewport = root.querySelector<HTMLElement>('[data-viewport]')
  const statusValue = root.querySelector<HTMLElement>('[data-status]')
  const pointerStateValue = root.querySelector<HTMLElement>(
    '[data-pointer-state]'
  )
  const fixedRateValue = root.querySelector<HTMLElement>('[data-fixed-rate]')
  const fpsValue = root.querySelector<HTMLElement>('[data-fps]')
  const cpuTimeValue = root.querySelector<HTMLElement>('[data-cpu-time]')
  const gpuTimeValue = root.querySelector<HTMLElement>('[data-gpu-time]')
  const meshTimeValue = root.querySelector<HTMLElement>('[data-mesh-time]')
  const gpuVoxelCountValue = root.querySelector<HTMLElement>(
    '[data-gpu-voxel-count]'
  )
  const gpuVoxelMegabytesValue = root.querySelector<HTMLElement>(
    '[data-gpu-voxel-mb]'
  )
  const gpuMeshCountValue = root.querySelector<HTMLElement>(
    '[data-gpu-mesh-count]'
  )
  const gpuMeshMegabytesValue =
    root.querySelector<HTMLElement>('[data-gpu-mesh-mb]')
  const vertexBytesValue = root.querySelector<HTMLElement>(
    '[data-vertex-bytes]'
  )
  const profileStateValue = root.querySelector<HTMLElement>(
    '[data-profile-state]'
  )
  const chunkCountValue = root.querySelector<HTMLElement>('[data-chunk-count]')
  const playerChunkValue = root.querySelector<HTMLElement>(
    '[data-player-chunk]'
  )
  const visibleChunksValue = root.querySelector<HTMLElement>(
    '[data-visible-chunks]'
  )
  const positionValue = root.querySelector<HTMLElement>('[data-position]')
  const faceCountValue = root.querySelector<HTMLElement>('[data-face-count]')
  const triangleCountValue = root.querySelector<HTMLElement>(
    '[data-triangle-count]'
  )
  const drawCallsValue = root.querySelector<HTMLElement>('[data-draw-calls]')
  const lockButton = root.querySelector<HTMLButtonElement>('[data-lock-button]')
  const profileButton = root.querySelector<HTMLButtonElement>(
    '[data-profile-button]'
  )
  const copyProfileButton = root.querySelector<HTMLButtonElement>(
    '[data-copy-profile-button]'
  )
  const profileReportValue = root.querySelector<HTMLElement>(
    '[data-profile-report]'
  )

  if (
    viewport === null ||
    statusValue === null ||
    pointerStateValue === null ||
    fixedRateValue === null ||
    fpsValue === null ||
    cpuTimeValue === null ||
    gpuTimeValue === null ||
    meshTimeValue === null ||
    gpuVoxelCountValue === null ||
    gpuVoxelMegabytesValue === null ||
    gpuMeshCountValue === null ||
    gpuMeshMegabytesValue === null ||
    vertexBytesValue === null ||
    profileStateValue === null ||
    chunkCountValue === null ||
    playerChunkValue === null ||
    visibleChunksValue === null ||
    positionValue === null ||
    faceCountValue === null ||
    triangleCountValue === null ||
    drawCallsValue === null ||
    lockButton === null ||
    profileButton === null ||
    copyProfileButton === null ||
    profileReportValue === null
  ) {
    throw new Error('Failed to mount debug world UI')
  }

  return {
    chunkCountValue,
    copyProfileButton,
    cpuTimeValue,
    drawCallsValue,
    faceCountValue,
    fixedRateValue,
    fpsValue,
    gpuMeshCountValue,
    gpuMeshMegabytesValue,
    gpuTimeValue,
    gpuVoxelCountValue,
    gpuVoxelMegabytesValue,
    lockButton,
    meshTimeValue,
    playerChunkValue,
    pointerStateValue,
    positionValue,
    profileButton,
    profileReportValue,
    profileStateValue,
    statusValue,
    triangleCountValue,
    vertexBytesValue,
    viewport,
    visibleChunksValue,
  }
}
