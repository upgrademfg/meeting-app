import type { VideoPoint, VideoRect } from '../domain/activity_event'
import type { ScreenRect } from '../domain/window_info'

export interface VideoProjection {
  point(x: number, y: number): VideoPoint
  rect(rect: ScreenRect): VideoRect
}
