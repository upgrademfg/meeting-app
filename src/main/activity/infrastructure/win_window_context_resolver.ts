import type { WindowInfo } from '../domain/window_info'
import type { WindowContext, WindowContextResolver } from '../ports/window_context_resolver'
import { runScript } from './script_runner'

const EXPLORER = /\\explorer\.exe$/i

const explorerFolder = (hwnd: number, title: string): string => `
$h = [int64]${hwnd}; $t = '${title.replace(/'/g, "''")}'; $hit = $null
foreach ($w in (New-Object -ComObject Shell.Application).Windows()) {
  try {
    if ([int64]$w.HWND -ne $h) { continue }
    $p = $w.Document.Folder.Self.Path
    if ($w.LocationName -eq $t) { $hit = $p; break }
    if (-not $hit) { $hit = $p }
  } catch {}
}
if ($hit) { [Console]::OutputEncoding = [Text.Encoding]::UTF8; $hit }`

export class WinWindowContextResolver implements WindowContextResolver {
  async resolve(window: WindowInfo): Promise<WindowContext> {
    if (!EXPLORER.test(window.appPath)) return {}
    const script = explorerFolder(window.windowId, window.title)
    const folderPath = await runScript('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], 5000)
    return { folderPath: folderPath || undefined }
  }
}
