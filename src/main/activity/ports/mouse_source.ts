import type { MouseButton } from '../domain/activity_event'

export interface MouseListener {
  down(x: number, y: number, button: MouseButton, clicks: number): void
  move(x: number, y: number): void
  wheel(x: number, y: number, direction: 'vertical' | 'horizontal', rotation: number): void
}

export interface MouseSource {
  start(listener: MouseListener): void
  stop(): void
}
