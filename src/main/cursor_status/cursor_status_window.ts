import { BrowserWindow, screen, type Point } from 'electron'
import type { CursorStatusAlign, CursorStatusView } from '../../shared/types'
import { mouseHub } from '../input/mouse_hub'
import type { CursorStatusDisplay } from './cursor_status_presenter'

const WIDTH = 300
const HEIGHT = 36
const GAP = { x: 16, y: 18 }
const PINNED_MARGIN = 12
const FRAME_MS = 8

export class CursorStatusWindow implements CursorStatusDisplay {
  private window?: BrowserWindow
  private unsubscribe?: () => void
  private target?: Point
  private frame?: NodeJS.Timeout
  private view?: CursorStatusView
  private align: CursorStatusAlign = 'left'

  constructor(
    private readonly preload: string,
    private readonly load: (window: BrowserWindow) => void,
    private readonly canFollowMouse: () => boolean
  ) {}

  show(view: CursorStatusView): void {
    this.view = view
    const window = this.ensureWindow()
    if (!window.isVisible()) {
      if (this.canFollowMouse()) {
        this.placeNear(screen.getCursorScreenPoint())
        this.unsubscribe = mouseHub.subscribe({ move: (e) => this.follow(this.toDip(e.x, e.y)) })
      } else {
        this.pin()
      }
      window.showInactive()
    }
    this.send()
  }

  hide(): void {
    this.unsubscribe?.()
    this.unsubscribe = undefined
    clearTimeout(this.frame)
    this.frame = undefined
    this.window?.hide()
  }

  private ensureWindow(): BrowserWindow {
    if (this.window && !this.window.isDestroyed()) return this.window
    const window = new BrowserWindow({
      width: WIDTH,
      height: HEIGHT,
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
    window.webContents.on('did-finish-load', () => this.send())
    this.load(window)
    this.window = window
    return window
  }

  private send(): void {
    if (this.view && this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('cursor-status:view', this.view, this.align)
    }
  }

  private toDip(x: number, y: number): Point {
    return process.platform === 'win32' ? screen.screenToDipPoint({ x, y }) : { x, y }
  }

  private follow(point: Point): void {
    this.target = point
    if (this.frame) return
    this.frame = setTimeout(() => {
      this.frame = undefined
      if (this.target) this.placeNear(this.target)
    }, FRAME_MS)
  }

  private placeNear(point: Point): void {
    const area = screen.getDisplayNearestPoint(point).workArea
    const fitsRight = point.x + GAP.x + WIDTH <= area.x + area.width
    const fitsBelow = point.y + GAP.y + HEIGHT <= area.y + area.height
    const x = fitsRight ? point.x + GAP.x : point.x - GAP.x / 2 - WIDTH
    const y = fitsBelow ? point.y + GAP.y : point.y - GAP.y / 2 - HEIGHT
    this.moveTo(x, y, fitsRight ? 'left' : 'right')
  }

  private pin(): void {
    const area = screen.getPrimaryDisplay().workArea
    this.moveTo(area.x + area.width - WIDTH - PINNED_MARGIN, area.y + PINNED_MARGIN, 'right')
  }

  private moveTo(x: number, y: number, align: CursorStatusAlign): void {
    if (!this.window || this.window.isDestroyed()) return
    this.window.setBounds({ x: Math.round(x), y: Math.round(y), width: WIDTH, height: HEIGHT })
    if (align !== this.align) {
      this.align = align
      this.send()
    }
  }
}
