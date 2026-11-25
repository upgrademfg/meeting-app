import { app, shell } from 'electron'
import { statSync, watch, type FSWatcher } from 'node:fs'
import { join } from 'node:path'
import type { OpenedPath, OpenedPathSource } from '../ports/opened_path_source'

const DUPLICATE_WINDOW_MS = 2000

export class WinRecentItemsSource implements OpenedPathSource {
  private watcher?: FSWatcher
  private seen = new Map<string, number>()

  start(listener: (opened: OpenedPath) => void): void {
    const recentDir = join(app.getPath('appData'), 'Microsoft', 'Windows', 'Recent')
    this.watcher = watch(recentDir, (_event, name) => {
      if (!name?.toLowerCase().endsWith('.lnk')) return
      try {
        const target = shell.readShortcutLink(join(recentDir, name)).target
        if (!target) return
        const now = Date.now()
        if (now - (this.seen.get(target) ?? 0) < DUPLICATE_WINDOW_MS) return
        this.seen.set(target, now)
        listener({ path: target, isDirectory: statSync(target).isDirectory() })
      } catch {}
    })
  }

  stop(): void {
    this.watcher?.close()
    this.watcher = undefined
  }
}
