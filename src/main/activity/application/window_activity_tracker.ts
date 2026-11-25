import { performance } from 'node:perf_hooks'
import type { VideoRect } from '../domain/activity_event'
import { isSameApp, isSameBounds, type WindowChange, type WindowInfo } from '../domain/window_info'
import type { ActivitySink } from '../ports/activity_sink'
import type { VideoProjection } from '../ports/video_projection'
import type { WindowContextResolver } from '../ports/window_context_resolver'
import type { WindowSource } from '../ports/window_source'

const MOVE_SETTLE_MS = 400

interface PendingMove {
  window: WindowInfo
  at: number
  timer: NodeJS.Timeout
}

export class WindowActivityTracker {
  private last?: WindowInfo
  private pendingMove?: PendingMove
  private queue: Promise<void> = Promise.resolve()

  constructor(
    private readonly windows: WindowSource,
    private readonly resolver: WindowContextResolver,
    private readonly projection: VideoProjection,
    private readonly sink: ActivitySink
  ) {}

  start(): boolean {
    const started = this.windows.start((change) => this.onChange(change))
    const current = this.windows.current()
    if (current) this.onChange({ kind: 'activate', window: current })
    return started
  }

  async stop(): Promise<void> {
    this.windows.stop()
    this.settleMove()
    await this.queue
  }

  private onChange({ kind, window }: WindowChange): void {
    if (kind === 'bounds') {
      this.scheduleMove(window)
      return
    }
    this.settleMove()
    const previous = this.last
    this.last = window
    if (isSameApp(previous, window) && previous?.title === window.title) return
    const at = performance.now()
    this.enqueue(() => this.recordWindow(window, at))
  }

  private async recordWindow(window: WindowInfo, at: number): Promise<void> {
    const context = await this.resolver.resolve(window)
    this.sink.record(
      {
        type: 'window_active',
        app: window.app,
        title: window.title,
        url: context.url,
        file: context.filePath,
        folder: context.folderPath,
        window: this.rectOf(window)
      },
      at
    )
  }

  private scheduleMove(window: WindowInfo): void {
    if (this.pendingMove) clearTimeout(this.pendingMove.timer)
    this.pendingMove = { window, at: performance.now(), timer: setTimeout(() => this.settleMove(), MOVE_SETTLE_MS) }
  }

  private settleMove(): void {
    const pending = this.pendingMove
    if (!pending) return
    clearTimeout(pending.timer)
    this.pendingMove = undefined
    const { window, at } = pending
    if (!window.bounds || isSameBounds(this.last?.bounds, window.bounds)) return
    this.last = window
    const rect = this.projection.rect(window.bounds)
    this.enqueue(() => this.sink.record({ type: 'window_move', app: window.app, title: window.title, window: rect }, at))
  }

  private rectOf(window: WindowInfo): VideoRect | undefined {
    return window.bounds && this.projection.rect(window.bounds)
  }

  private enqueue(task: () => void | Promise<void>): void {
    this.queue = this.queue.then(task)
  }
}
