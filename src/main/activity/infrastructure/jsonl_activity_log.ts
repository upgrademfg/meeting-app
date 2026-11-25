import { createWriteStream, type WriteStream } from 'node:fs'
import { performance } from 'node:perf_hooks'
import type { ActivityEvent } from '../domain/activity_event'
import type { ActivitySink } from '../ports/activity_sink'

export class JsonlActivityLog implements ActivitySink {
  private readonly out: WriteStream
  private readonly startedAt = Date.now()
  private readonly t0 = performance.now()

  constructor(path: string, meta: Record<string, unknown>) {
    this.out = createWriteStream(path, { flags: 'w' })
    this.write(0, { type: 'meta', version: 1, ...meta })
  }

  record(event: ActivityEvent, at = performance.now()): void {
    this.write(Math.max(0, Math.round(at - this.t0)), event)
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.out.end(resolve))
  }

  private write(offsetMs: number, body: object): void {
    const timestamp = new Date(this.startedAt + offsetMs).toISOString()
    this.out.write(JSON.stringify({ timestamp, offsetMs, ...body }) + '\n')
  }
}
