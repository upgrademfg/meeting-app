import { createWriteStream, type WriteStream } from 'node:fs'
import { performance } from 'node:perf_hooks'
import type { ActivityEvent } from '../domain/activity_event'
import type { ActivitySink } from '../ports/activity_sink'

export class JsonlActivityLog implements ActivitySink {
  private readonly out: WriteStream
  private readonly startedAtMs = Date.now()
  private readonly t0 = performance.now()

  constructor(path: string) {
    this.out = createWriteStream(path, { flags: 'w' })
  }

  get startedAt(): string {
    return new Date(this.startedAtMs).toISOString()
  }

  record(event: ActivityEvent, at = performance.now()): void {
    const offsetMs = Math.max(0, Math.round(at - this.t0))
    const timestamp = new Date(this.startedAtMs + offsetMs).toISOString()
    this.out.write(JSON.stringify({ timestamp, offsetMs, ...event }) + '\n')
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.out.end(resolve))
  }
}
