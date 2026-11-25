import type { WindowInfo } from '../domain/window_info'
import type { WindowContext, WindowContextResolver } from '../ports/window_context_resolver'
import { loadNativeAddon } from './native_addon'
import type { WinRecentFiles } from './win_recent_files'

const EXPLORER = /\\explorer\.exe$/i

interface WindowContextAddon {
  explorerFolder(hwnd: number, title: string): Promise<string>
}

export class WinWindowContextResolver implements WindowContextResolver {
  constructor(private readonly recentFiles: WinRecentFiles) {}

  async resolve(window: WindowInfo): Promise<WindowContext> {
    if (!EXPLORER.test(window.appPath)) return { filePath: this.recentFiles.findInTitle(window.title) }
    const addon = loadNativeAddon<WindowContextAddon>('window_context')
    const folderPath = await addon.explorerFolder(window.windowId, window.title)
    return { folderPath: folderPath || undefined }
  }
}
