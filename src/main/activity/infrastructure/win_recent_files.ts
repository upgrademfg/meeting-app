import { app, shell } from 'electron'
import { statSync, watch, type FSWatcher } from 'node:fs'
import { basename, extname, join } from 'node:path'

const MAX_FILES = 50

export class WinRecentFiles {
  private watcher?: FSWatcher
  private files: string[] = []

  start(): void {
    const recentDir = join(app.getPath('appData'), 'Microsoft', 'Windows', 'Recent')
    this.watcher = watch(recentDir, (_event, name) => {
      if (!name?.toLowerCase().endsWith('.lnk')) return
      try {
        const target = shell.readShortcutLink(join(recentDir, name)).target
        if (!target || statSync(target).isDirectory()) return
        this.files = [target, ...this.files.filter((file) => file !== target)].slice(0, MAX_FILES)
      } catch {}
    })
  }

  stop(): void {
    this.watcher?.close()
    this.watcher = undefined
    this.files = []
  }

  findInTitle(title: string): string | undefined {
    const lowerTitle = title.toLowerCase()
    return this.files.find((file) => {
      const name = basename(file, extname(file)).toLowerCase()
      return name.length > 0 && lowerTitle.includes(name)
    })
  }
}
