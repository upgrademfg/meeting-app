import { createWriteStream, type WriteStream } from 'node:fs'
import { performance } from 'node:perf_hooks'

export type RecEvent =
  | { type: 'mouse_down'; button: 'left' | 'right' | 'middle' | 'other'; clicks: number; x: number; y: number }
  | { type: 'mouse_move'; x: number; y: number }
  | { type: 'wheel'; direction: 'vertical' | 'horizontal'; rotation: number; x: number; y: number }
  | { type: 'app_switch'; app: string; title: string; url?: string }
  | { type: 'window_title'; app: string; title: string; url?: string }
  | { type: 'folder_active'; path: string; app?: string }
  | { type: 'file_active'; path: string; app?: string }
  | { type: 'warning'; message: string }

export class EventLog {
  private readonly out: WriteStream
  private readonly t0 = performance.now()

  constructor(path: string, meta: Record<string, unknown>) {
    this.out = createWriteStream(path, { flags: 'w' })
    this.write({ t: 0, type: 'meta', version: 1, ...meta })
  }

  log(event: RecEvent): void {
    this.write({ t: Math.round(performance.now() - this.t0), ...event })
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.out.end(resolve))
  }

  private write(line: Record<string, unknown>): void {
    this.out.write(JSON.stringify(line) + '\n')
  }
}
