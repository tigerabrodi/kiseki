type PointerLockEventTarget = {
  addEventListener: (type: 'lock' | 'unlock', listener: () => void) => void
  removeEventListener: (type: 'lock' | 'unlock', listener: () => void) => void
}

type InstallDebugWorldEventHandlersOptions = {
  canvas: HTMLCanvasElement
  controls: PointerLockEventTarget
  copyProfileButton: HTMLButtonElement
  handleCopyProfileButtonPress: () => void
  handleKeyDown: (event: KeyboardEvent) => void
  handleKeyUp: (event: KeyboardEvent) => void
  handleLock: () => void
  handleLockButtonClick: () => void
  handleProfileButtonPress: () => void
  handleUnlock: () => void
  handleViewportContextMenu: (event: MouseEvent) => void
  handleViewportMouseDown: (event: MouseEvent) => void
  lockButton: HTMLButtonElement
  profileButton: HTMLButtonElement
}

export function installDebugWorldEventHandlers(
  options: InstallDebugWorldEventHandlersOptions
): () => void {
  document.addEventListener('keydown', options.handleKeyDown)
  document.addEventListener('keyup', options.handleKeyUp)
  options.controls.addEventListener('lock', options.handleLock)
  options.controls.addEventListener('unlock', options.handleUnlock)
  options.lockButton.addEventListener('click', options.handleLockButtonClick)
  options.profileButton.addEventListener(
    'click',
    options.handleProfileButtonPress
  )
  options.copyProfileButton.addEventListener(
    'click',
    options.handleCopyProfileButtonPress
  )
  options.canvas.addEventListener('mousedown', options.handleViewportMouseDown)
  options.canvas.addEventListener(
    'contextmenu',
    options.handleViewportContextMenu
  )

  return () => {
    document.removeEventListener('keydown', options.handleKeyDown)
    document.removeEventListener('keyup', options.handleKeyUp)
    options.controls.removeEventListener('lock', options.handleLock)
    options.controls.removeEventListener('unlock', options.handleUnlock)
    options.lockButton.removeEventListener(
      'click',
      options.handleLockButtonClick
    )
    options.profileButton.removeEventListener(
      'click',
      options.handleProfileButtonPress
    )
    options.copyProfileButton.removeEventListener(
      'click',
      options.handleCopyProfileButtonPress
    )
    options.canvas.removeEventListener(
      'mousedown',
      options.handleViewportMouseDown
    )
    options.canvas.removeEventListener(
      'contextmenu',
      options.handleViewportContextMenu
    )
  }
}
