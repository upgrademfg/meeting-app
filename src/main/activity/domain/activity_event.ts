export interface VideoPoint {
  x: number
  y: number
}

export interface VideoRect extends VideoPoint {
  width: number
  height: number
}

export type MouseButton = 'left' | 'right' | 'middle' | 'other'

export type ActivityEvent =
  | ({ type: 'mouse_down'; button: MouseButton; clicks: number } & VideoPoint)
  | ({ type: 'mouse_move' } & VideoPoint)
  | ({ type: 'wheel'; direction: 'vertical' | 'horizontal'; rotation: number } & VideoPoint)
  | { type: 'window_active'; app: string; title: string; url?: string; window?: VideoRect }
  | { type: 'window_move'; app: string; title: string; window: VideoRect }
  | { type: 'folder_active'; path: string; app?: string; window?: VideoRect }
  | { type: 'file_active'; path: string; app?: string; window?: VideoRect }
  | { type: 'warning'; message: string }
