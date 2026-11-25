import { screen } from 'electron'
import type { CaptureLayout } from '../../../shared/types'
import type { VideoPoint, VideoRect } from '../domain/activity_event'
import type { ScreenRect } from '../domain/window_info'
import type { VideoProjection } from '../ports/video_projection'

const physicalPixels = process.platform === 'win32'

export class ElectronVideoProjection implements VideoProjection {
  constructor(private readonly layout: CaptureLayout) {}

  point(x: number, y: number): VideoPoint {
    const p = physicalPixels ? screen.screenToDipPoint({ x, y }) : { x, y }
    return { x: this.scaleX(p.x), y: this.scaleY(p.y) }
  }

  rect(rect: ScreenRect): VideoRect {
    const r = physicalPixels ? screen.screenToDipRect(null, rect) : rect
    return {
      x: this.scaleX(r.x),
      y: this.scaleY(r.y),
      width: Math.round(r.width * this.layout.scale),
      height: Math.round(r.height * this.layout.scale)
    }
  }

  private scaleX(x: number): number {
    return Math.round((x - this.layout.originX) * this.layout.scale)
  }

  private scaleY(y: number): number {
    return Math.round((y - this.layout.originY) * this.layout.scale)
  }
}
