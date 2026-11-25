import { uIOhook, WheelDirection, type UiohookMouseEvent, type UiohookWheelEvent } from 'uiohook-napi'
import type { MouseButton } from '../domain/activity_event'
import type { MouseListener, MouseSource } from '../ports/mouse_source'

const BUTTONS: Record<number, MouseButton> = { 1: 'left', 2: 'right', 3: 'middle' }

export class UiohookMouseSource implements MouseSource {
  private listener?: MouseListener

  start(listener: MouseListener): void {
    this.listener = listener
    uIOhook.on('mousedown', this.onDown)
    uIOhook.on('mousemove', this.onMove)
    uIOhook.on('wheel', this.onWheel)
    uIOhook.start()
  }

  stop(): void {
    if (!this.listener) return
    this.listener = undefined
    uIOhook.removeListener('mousedown', this.onDown)
    uIOhook.removeListener('mousemove', this.onMove)
    uIOhook.removeListener('wheel', this.onWheel)
    uIOhook.stop()
  }

  private onDown = (e: UiohookMouseEvent): void => {
    this.listener?.down(e.x, e.y, BUTTONS[e.button as number] ?? 'other', e.clicks)
  }

  private onMove = (e: UiohookMouseEvent): void => {
    this.listener?.move(e.x, e.y)
  }

  private onWheel = (e: UiohookWheelEvent): void => {
    this.listener?.wheel(e.x, e.y, e.direction === WheelDirection.HORIZONTAL ? 'horizontal' : 'vertical', e.rotation)
  }
}
