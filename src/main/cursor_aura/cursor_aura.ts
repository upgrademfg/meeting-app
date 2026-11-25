import { BrowserWindow, screen } from 'electron'
import { mouseHub } from '../input/mouse_hub'

const SIZE = 96
const CENTER_FROM_HOTSPOT = { x: 5, y: 8 }
const FRAME_MS = 8

export class CursorAura {
  private window?: BrowserWindow
  private unsubscribe?: () => void
  private target?: { x: number; y: number }
  private frame?: NodeJS.Timeout

  constructor(
    private readonly preload: string,
    private readonly load: (window: BrowserWindow) => void
  ) {}

  show(): void {
    if (this.unsubscribe) return
    const window = this.ensureWindow()
    this.placeAt(screen.getCursorScreenPoint())
    window.showInactive()
    this.unsubscribe = mouseHub.subscribe({
      move: (e) => this.follow(this.toDip(e.x, e.y)),
      down: () => window.webContents.send('cursor:click')
    })
  }

  hide(): void {
    this.unsubscribe?.()
    this.unsubscribe = undefined
    clearTimeout(this.frame)
    this.frame = undefined
    this.window?.hide()
  }

  destroy(): void {
    this.hide()
    this.window?.destroy()
    this.window = undefined
  }

  private ensureWindow(): BrowserWindow {
    if (this.window && !this.window.isDestroyed()) return this.window
    const window = new BrowserWindow({
      width: SIZE,
      height: SIZE,
      show: false,
      frame: false,
      transparent: true,
      hasShadow: false,
      resizable: false,
      movable: false,
      focusable: false,
      skipTaskbar: true,
      fullscreenable: false,
      type: process.platform === 'darwin' ? 'panel' : 'toolbar',
      webPreferences: { preload: this.preload, backgroundThrottling: false }
    })
    window.setIgnoreMouseEvents(true)
    window.setAlwaysOnTop(true, 'screen-saver')
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    window.setContentProtection(true)
    this.load(window)
    this.window = window
    return window
  }

  private toDip(x: number, y: number): { x: number; y: number } {
    return process.platform === 'win32' ? screen.screenToDipPoint({ x, y }) : { x, y }
  }

  private follow(point: { x: number; y: number }): void {
    this.target = point
    if (this.frame) return
    this.frame = setTimeout(() => {
      this.frame = undefined
      if (this.target) this.placeAt(this.target)
    }, FRAME_MS)
  }

  private placeAt(point: { x: number; y: number }): void {
    if (!this.window || this.window.isDestroyed()) return
    const x = Math.round(point.x + CENTER_FROM_HOTSPOT.x - SIZE / 2)
    const y = Math.round(point.y + CENTER_FROM_HOTSPOT.y - SIZE / 2)
    this.window.setBounds({ x, y, width: SIZE, height: SIZE })
  }
}
