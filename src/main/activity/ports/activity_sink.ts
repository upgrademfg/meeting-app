import type { ActivityEvent } from '../domain/activity_event'

export interface ActivitySink {
  record(event: ActivityEvent, at?: number): void
}
