import type { WindowChange, WindowInfo } from '../domain/window_info'

export interface WindowSource {
  start(listener: (change: WindowChange) => void): boolean
  stop(): void
  current(): WindowInfo | undefined
}
