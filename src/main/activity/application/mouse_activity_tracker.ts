import type { ActivitySink } from '../ports/activity_sink'
import type { MouseSource } from '../ports/mouse_source'
import type { VideoProjection } from '../ports/video_projection'

const MOVE_INTERVAL_MS = 100
const MOVE_MIN_DISTANCE = 3
const WHEEL_INTERVAL_MS = 200

export class MouseActivityTracker {
  private lastMoveAt = 0
  private lastMove = { x: -1, y: -1 }
  private lastWheelAt = 0

  constructor(
    private readonly mouse: MouseSource,
    private readonly projection: VideoProjection,
    private readonly sink: ActivitySink
  ) {}

  start(): void {
    this.mouse.start({
      down: (x, y, button, clicks) => {
        this.sink.record({ type: 'mouse_down', button, clicks, ...this.projection.point(x, y) })
      },
      move: (x, y) => {
        const now = Date.now()
        if (now - this.lastMoveAt < MOVE_INTERVAL_MS) return
        const p = this.projection.point(x, y)
        if (Math.abs(p.x - this.lastMove.x) + Math.abs(p.y - this.lastMove.y) < MOVE_MIN_DISTANCE) return
        this.lastMoveAt = now
        this.lastMove = p
        this.sink.record({ type: 'mouse_move', ...p })
      },
      wheel: (x, y, direction, rotation) => {
        const now = Date.now()
        if (now - this.lastWheelAt < WHEEL_INTERVAL_MS) return
        this.lastWheelAt = now
        this.sink.record({ type: 'wheel', direction, rotation, ...this.projection.point(x, y) })
      }
    })
  }

  stop(): void {
    this.mouse.stop()
  }
}
