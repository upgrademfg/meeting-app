import { fileURLToPath } from 'node:url'
import type { WindowInfo } from '../domain/window_info'
import type { WindowContext, WindowContextResolver } from '../ports/window_context_resolver'
import { runScript } from './script_runner'

const FINDER = 'com.apple.finder'
const SAFARI = new Set(['com.apple.Safari', 'com.apple.SafariTechnologyPreview'])
const CHROMIUM = new Set([
  'com.google.Chrome',
  'com.google.Chrome.beta',
  'com.microsoft.edgemac',
  'com.brave.Browser',
  'com.vivaldi.Vivaldi',
  'com.operasoftware.Opera',
  'company.thebrowser.Browser'
])

const FINDER_FOLDER = `
tell application id "com.apple.finder"
  if (count of Finder windows) is 0 then return ""
  try
    return POSIX path of (target of front Finder window as alias)
  end try
end tell
return ""`

const browserUrl = (bundleId: string, tab: string): string => `
tell application id "${bundleId}"
  try
    return URL of ${tab} of front window
  end try
end tell
return ""`

export class MacWindowContextResolver implements WindowContextResolver {
  async resolve(window: WindowInfo): Promise<WindowContext> {
    const { bundleId, documentUrl } = window
    if (bundleId === FINDER) return { folderPath: (await osascript(FINDER_FOLDER)) || undefined }
    if (bundleId && SAFARI.has(bundleId)) return { url: (await osascript(browserUrl(bundleId, 'current tab'))) || undefined }
    if (bundleId && CHROMIUM.has(bundleId)) return { url: (await osascript(browserUrl(bundleId, 'active tab'))) || undefined }
    if (documentUrl?.startsWith('file://')) return { filePath: fileURLToPath(documentUrl) }
    return {}
  }
}

function osascript(script: string): Promise<string> {
  return runScript('osascript', ['-e', script])
}
