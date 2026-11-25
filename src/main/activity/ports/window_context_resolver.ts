import type { WindowInfo } from '../domain/window_info'

export interface WindowContext {
  folderPath?: string
  filePath?: string
  url?: string
}

export interface WindowContextResolver {
  resolve(window: WindowInfo): Promise<WindowContext>
}
