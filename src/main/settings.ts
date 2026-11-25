import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface Settings {
  outputDir?: string
}

const file = (): string => join(app.getPath('userData'), 'settings.json')

export function loadSettings(): Settings {
  return existsSync(file()) ? (JSON.parse(readFileSync(file(), 'utf8')) as Settings) : {}
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...patch }
  writeFileSync(file(), JSON.stringify(next, null, 2))
  return next
}
