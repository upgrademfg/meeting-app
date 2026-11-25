import { app } from 'electron'
import { join } from 'node:path'

const loaded = new Map<string, unknown>()

export function loadNativeAddon<T>(name: 'window_events' | 'window_context'): T {
  if (!loaded.has(name)) {
    const path = join(app.getAppPath(), 'native', 'build', 'Release', `${name}.node`)
    const module = { exports: {} }
    process.dlopen(module, path.replace('app.asar', 'app.asar.unpacked'))
    loaded.set(name, module.exports)
  }
  return loaded.get(name) as T
}
