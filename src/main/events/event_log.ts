import { createWriteStream, type WriteStream } from 'node:fs'
import { performance } from 'node:perf_hooks'
import type { VideoRect } from './video_coords'

export type RecEvent =
  | { type: 'mouse_down'; button: 'left' | 'right' | 'middle' | 'other'; clicks: number; x: number; y: number }
  | { type: 'mouse_move'; x: number; y: number }
  | { type: 'wheel'; direction: 'vertical' | 'horizontal'; rotation: number; x: number; y: number }
  | { type: 'app_switch'; app: string; title: string; url?: string; window: VideoRect }
  | { type: 'window_title'; app: string; title: string; url?: string; window: VideoRect }
  | { type: 'folder_active'; path: string; app?: string; window?: VideoRect }
  | { type: 'file_active'; path: string; app?: string; window?: VideoRect }
  | { type: 'warning'; message: string }

export class EventLog {
  private readonly out: WriteStream
  private readonly startedAt = Date.now()
  private readonly t0 = performance.now()

  constructor(path: string, meta: Record<string, unknown>) {
    this.out = createWriteStream(path, { flags: 'w' })
    this.write({ ...this.stamp(0), type: 'meta', version: 1, ...meta })
  }

  log(event: RecEvent): void {
    this.write({ ...this.stamp(Math.round(performance.now() - this.t0)), ...event })
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.out.end(resolve))
  }

  private stamp(offsetMs: number): { timestamp: string; offsetMs: number } {
    return { timestamp: new Date(this.startedAt + offsetMs).toISOString(), offsetMs }
  }

  private write(line: Record<string, unknown>): void {
    this.out.write(JSON.stringify(line) + '\n')
  }
}
