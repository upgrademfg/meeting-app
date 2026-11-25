import { app, shell } from 'electron'
import { statSync, watch, type FSWatcher } from 'node:fs'
import { join } from 'node:path'
import { activeWindow } from 'get-windows'
import type { RecEvent } from './event_log'
import { macFinderFolder, macFrontDocument, winExplorerFolder } from './platform'

const POLL_MS = 1000
const CLICK_DELAY_MS = 300

export class ContextTracker {
  private timer?: NodeJS.Timeout
  private busy = false
  private again = false
  private lastApp = ''
  private lastTitle = ''
  private lastFolder = ''
  private lastFile = ''
  private recentWatcher?: FSWatcher
  private recentSeen = new Map<string, number>()

  constructor(private readonly emit: (event: RecEvent) => void) {}

  start(): void {
    this.timer = setInterval(() => void this.poll(), POLL_MS)
    void this.poll()
    if (process.platform === 'win32') this.watchWindowsRecent()
  }

  stop(): void {
    clearInterval(this.timer)
    this.recentWatcher?.close()
    this.recentWatcher = undefined
  }

  nudge(): void {
    setTimeout(() => void this.poll(), CLICK_DELAY_MS)
  }

  private async poll(): Promise<void> {
    if (this.busy) {
      this.again = true
      return
    }
    this.busy = true
    try {
      await this.inspect()
    } catch {} finally {
      this.busy = false
      if (this.again) {
        this.again = false
        void this.poll()
      }
    }
  }

  private async inspect(): Promise<void> {
    const win = await activeWindow()
    if (!win) return
    const appName = win.owner.name
    const { title } = win
    const url = win.platform === 'macos' ? win.url : undefined
    const appChanged = appName !== this.lastApp
    if (!appChanged && title === this.lastTitle) return
    this.lastApp = appName
    this.lastTitle = title
    this.emit({ type: appChanged ? 'app_switch' : 'window_title', app: appName, title, url })

    if (win.platform === 'macos') {
      if (win.owner.bundleId === 'com.apple.finder') this.report('folder', await macFinderFolder(), appName)
      else this.report('file', await macFrontDocument(), appName)
    } else if (win.platform === 'windows' && /\\explorer\.exe$/i.test(win.owner.path)) {
      this.report('folder', await winExplorerFolder(win.id, title), appName)
    }
  }

  private report(kind: 'folder' | 'file', path: string | undefined, appName?: string): void {
    if (!path) return
    if (kind === 'folder') {
      if (path === this.lastFolder) return
      this.lastFolder = path
      this.emit({ type: 'folder_active', path, app: appName })
    } else {
      if (path === this.lastFile) return
      this.lastFile = path
      this.emit({ type: 'file_active', path, app: appName })
    }
  }

  private watchWindowsRecent(): void {
    const recentDir = join(app.getPath('appData'), 'Microsoft', 'Windows', 'Recent')
    this.recentWatcher = watch(recentDir, (_event, name) => {
      if (!name?.toLowerCase().endsWith('.lnk')) return
      try {
        const target = shell.readShortcutLink(join(recentDir, name)).target
        if (!target) return
        const now = Date.now()
        if (now - (this.recentSeen.get(target) ?? 0) < 2000) return
        this.recentSeen.set(target, now)
        const isDir = statSync(target).isDirectory()
        this.report(isDir ? 'folder' : 'file', target)
      } catch {}
    })
  }
}
