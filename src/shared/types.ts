export type RecorderStatus = 'idle' | 'starting' | 'recording' | 'finalizing'

export type PermissionStatus = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown'

export interface PermissionState {
  platform: string
  screen: PermissionStatus
  microphone: PermissionStatus
  accessibility: boolean
}

export interface AppState {
  status: RecorderStatus
  startedAt?: number
  outputDir?: string
  lastFile?: string
  warnings: string[]
  error?: string
  permissions: PermissionState
}

export interface ScreenRegion {
  sourceId: string
  displayId: string
  x: number
  y: number
  width: number
  height: number
}

export interface CaptureLayout {
  width: number
  height: number
  scale: number
  originX: number
  originY: number
  screens: ScreenRegion[]
}

export interface RecorderStartConfig {
  layout: CaptureLayout
  fps: number
  videoBitsPerSecond: number
}

export interface RecorderStartedInfo {
  mimeType: string
  hasSystemAudio: boolean
  hasMic: boolean
}

export type PermissionKind = 'screen' | 'microphone' | 'accessibility'

export interface Api {
  getState(): Promise<AppState>
  onState(cb: (state: AppState) => void): () => void
  startRecording(): Promise<void>
  stopRecording(): Promise<void>
  chooseOutputDir(): Promise<void>
  openOutputDir(): Promise<void>
  revealFile(path: string): Promise<void>
  requestPermissions(): Promise<void>
  openPermissionSettings(kind: PermissionKind): Promise<void>

  onRecorderStart(cb: (config: RecorderStartConfig) => void): void
  onRecorderStop(cb: () => void): void
  recorderStarted(info: RecorderStartedInfo): void
  recorderChunk(data: Uint8Array): void
  recorderStopped(): void
  recorderError(message: string): void

  onCursorClick(cb: () => void): void
}
