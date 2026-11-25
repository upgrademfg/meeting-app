import { WheelDirection } from 'uiohook-napi'
import { mouseHub } from '../../input/mouse_hub'
import type { MouseButton } from '../domain/activity_event'
import type { MouseListener, MouseSource } from '../ports/mouse_source'

const BUTTONS: Record<number, MouseButton> = { 1: 'left', 2: 'right', 3: 'middle' }

export class UiohookMouseSource implements MouseSource {
  private unsubscribe?: () => void

  start(listener: MouseListener): void {
    this.unsubscribe = mouseHub.subscribe({
      down: (e) => listener.down(e.x, e.y, BUTTONS[e.button as number] ?? 'other', e.clicks),
      move: (e) => listener.move(e.x, e.y),
      wheel: (e) =>
        listener.wheel(e.x, e.y, e.direction === WheelDirection.HORIZONTAL ? 'horizontal' : 'vertical', e.rotation)
    })
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = undefined
  }
}
