import { screen, type Rectangle } from 'electron'
import type { CaptureLayout } from '../../shared/types'

export interface VideoRect {
  x: number
  y: number
  width: number
  height: number
}

const isWindows = process.platform === 'win32'

export function pointToVideo(layout: CaptureLayout, x: number, y: number): { x: number; y: number } {
  const p = isWindows ? screen.screenToDipPoint({ x, y }) : { x, y }
  return {
    x: Math.round((p.x - layout.originX) * layout.scale),
    y: Math.round((p.y - layout.originY) * layout.scale)
  }
}

export function rectToVideo(layout: CaptureLayout, rect: Rectangle): VideoRect {
  const r = isWindows ? screen.screenToDipRect(null, rect) : rect
  return {
    x: Math.round((r.x - layout.originX) * layout.scale),
    y: Math.round((r.y - layout.originY) * layout.scale),
    width: Math.round(r.width * layout.scale),
    height: Math.round(r.height * layout.scale)
  }
}
