import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'

function run(cmd: string, args: string[], timeout = 3000): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, windowsHide: true }, (err, stdout) => {
      resolve(err ? '' : stdout.trim())
    })
  })
}

const MAC_FINDER_FOLDER = `
tell application "Finder"
  if (count of Finder windows) is 0 then return ""
  try
    return POSIX path of (target of front Finder window as alias)
  end try
end tell
return ""`

const MAC_FRONT_DOCUMENT = `
tell application "System Events"
  set p to first application process whose frontmost is true
  try
    return value of attribute "AXDocument" of front window of p
  end try
end tell
return ""`

export async function macFinderFolder(): Promise<string | undefined> {
  return (await run('osascript', ['-e', MAC_FINDER_FOLDER])) || undefined
}

export async function macFrontDocument(): Promise<string | undefined> {
  const value = await run('osascript', ['-e', MAC_FRONT_DOCUMENT])
  if (!value || value === 'missing value') return undefined
  return value.startsWith('file://') ? fileURLToPath(value) : value
}

export async function winExplorerFolder(hwnd: number, title: string): Promise<string | undefined> {
  const script = `
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
  return (await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], 5000)) || undefined
}
