import { uIOhook, WheelDirection, type UiohookMouseEvent, type UiohookWheelEvent } from 'uiohook-napi'
import type { CaptureLayout } from '../../shared/types'
import type { RecEvent } from './event_log'
import { pointToVideo } from './video_coords'

const MOVE_INTERVAL_MS = 100
const WHEEL_INTERVAL_MS = 200
const BUTTONS = { 1: 'left', 2: 'right', 3: 'middle' } as const

export class InputTracker {
  private lastMoveAt = 0
  private lastMove = { x: -1, y: -1 }
  private lastWheelAt = 0
  private running = false

  constructor(
    private readonly layout: CaptureLayout,
    private readonly emit: (event: RecEvent) => void,
    private readonly onMouseDown: () => void
  ) {}

  start(): void {
    uIOhook.on('mousedown', this.handleDown)
    uIOhook.on('mousemove', this.handleMove)
    uIOhook.on('wheel', this.handleWheel)
    uIOhook.start()
    this.running = true
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    uIOhook.removeListener('mousedown', this.handleDown)
    uIOhook.removeListener('mousemove', this.handleMove)
    uIOhook.removeListener('wheel', this.handleWheel)
    uIOhook.stop()
  }

  private handleDown = (e: UiohookMouseEvent): void => {
    const button = BUTTONS[e.button as keyof typeof BUTTONS] ?? 'other'
    this.emit({ type: 'mouse_down', button, clicks: e.clicks, ...pointToVideo(this.layout, e.x, e.y) })
    this.onMouseDown()
  }

  private handleMove = (e: UiohookMouseEvent): void => {
    const now = Date.now()
    if (now - this.lastMoveAt < MOVE_INTERVAL_MS) return
    const p = pointToVideo(this.layout, e.x, e.y)
    if (Math.abs(p.x - this.lastMove.x) + Math.abs(p.y - this.lastMove.y) < 3) return
    this.lastMoveAt = now
    this.lastMove = p
    this.emit({ type: 'mouse_move', ...p })
  }

  private handleWheel = (e: UiohookWheelEvent): void => {
    const now = Date.now()
    if (now - this.lastWheelAt < WHEEL_INTERVAL_MS) return
    this.lastWheelAt = now
    this.emit({
      type: 'wheel',
      direction: e.direction === WheelDirection.HORIZONTAL ? 'horizontal' : 'vertical',
      rotation: e.rotation,
      ...pointToVideo(this.layout, e.x, e.y)
    })
  }
}
