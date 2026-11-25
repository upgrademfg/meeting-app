import { uIOhook, type UiohookMouseEvent, type UiohookWheelEvent } from 'uiohook-napi'

export interface MouseHubListener {
  down?(event: UiohookMouseEvent): void
  move?(event: UiohookMouseEvent): void
  wheel?(event: UiohookWheelEvent): void
}

class MouseHub {
  private readonly listeners = new Set<MouseHubListener>()

  subscribe(listener: MouseHubListener): () => void {
    this.listeners.add(listener)
    if (this.listeners.size === 1) this.attach()
    return () => {
      if (!this.listeners.delete(listener)) return
      if (this.listeners.size === 0) this.detach()
    }
  }

  private attach(): void {
    uIOhook.on('mousedown', this.onDown)
    uIOhook.on('mousemove', this.onMove)
    uIOhook.on('wheel', this.onWheel)
    uIOhook.start()
  }

  private detach(): void {
    uIOhook.removeListener('mousedown', this.onDown)
    uIOhook.removeListener('mousemove', this.onMove)
    uIOhook.removeListener('wheel', this.onWheel)
    uIOhook.stop()
  }

  private onDown = (event: UiohookMouseEvent): void => this.listeners.forEach((l) => l.down?.(event))
  private onMove = (event: UiohookMouseEvent): void => this.listeners.forEach((l) => l.move?.(event))
  private onWheel = (event: UiohookWheelEvent): void => this.listeners.forEach((l) => l.wheel?.(event))
}

export const mouseHub = new MouseHub()
