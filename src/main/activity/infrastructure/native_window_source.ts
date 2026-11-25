import type { WindowChange, WindowChangeKind, WindowInfo } from '../domain/window_info'
import type { WindowSource } from '../ports/window_source'
import { loadNativeAddon } from './native_addon'

interface WindowEventsAddon {
  start(listener: (event: { kind: WindowChangeKind; window: WindowInfo }) => void): boolean
  stop(): void
  activeWindow(): WindowInfo | null
}

const addon = (): WindowEventsAddon => loadNativeAddon<WindowEventsAddon>('window_events')

export class NativeWindowSource implements WindowSource {
  start(listener: (change: WindowChange) => void): boolean {
    return addon().start(listener)
  }

  stop(): void {
    addon().stop()
  }

  current(): WindowInfo | undefined {
    return addon().activeWindow() ?? undefined
  }
}
