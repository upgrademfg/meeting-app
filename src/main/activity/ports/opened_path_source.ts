export interface OpenedPath {
  path: string
  isDirectory: boolean
}

export interface OpenedPathSource {
  start(listener: (opened: OpenedPath) => void): void
  stop(): void
}
