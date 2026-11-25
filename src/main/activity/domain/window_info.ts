export interface ScreenRect {
  x: number
  y: number
  width: number
  height: number
}

export interface WindowInfo {
  pid: number
  windowId: number
  app: string
  appPath: string
  bundleId?: string
  title: string
  documentUrl?: string
  bounds?: ScreenRect
}

export type WindowChangeKind = 'activate' | 'title' | 'bounds'

export interface WindowChange {
  kind: WindowChangeKind
  window: WindowInfo
}

export function isSameApp(a: WindowInfo | undefined, b: WindowInfo): boolean {
  return !!a && a.pid === b.pid
}

export function isSameBounds(a: ScreenRect | undefined, b: ScreenRect | undefined): boolean {
  if (!a || !b) return a === b
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}
