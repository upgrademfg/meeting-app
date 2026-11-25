import { app } from 'electron'
import { join } from 'node:path'
import type { WindowChange, WindowChangeKind, WindowInfo } from '../domain/window_info'
import type { WindowSource } from '../ports/window_source'

interface NativeWindowEvents {
  start(listener: (event: { kind: WindowChangeKind; window: WindowInfo }) => void): boolean
  stop(): void
  activeWindow(): WindowInfo | null
}

let addon: NativeWindowEvents | undefined

function loadAddon(): NativeWindowEvents {
  if (addon) return addon
  const path = join(app.getAppPath(), 'native', 'window_events', 'build', 'Release', 'window_events.node')
  const module = { exports: {} as NativeWindowEvents }
  process.dlopen(module, path.replace('app.asar', 'app.asar.unpacked'))
  addon = module.exports
  return addon
}

export class NativeWindowSource implements WindowSource {
  start(listener: (change: WindowChange) => void): boolean {
    return loadAddon().start(listener)
  }

  stop(): void {
    loadAddon().stop()
  }

  current(): WindowInfo | undefined {
    return loadAddon().activeWindow() ?? undefined
  }
}
