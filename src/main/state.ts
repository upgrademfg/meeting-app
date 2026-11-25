import { EventEmitter } from 'node:events'
import type { AppState } from '../shared/types'
import { getPermissions } from './permissions'
import { loadSettings } from './settings'

export class StateStore extends EventEmitter<{ change: [AppState] }> {
  private state: AppState = {
    status: 'idle',
    outputDir: loadSettings().outputDir,
    warnings: [],
    permissions: getPermissions()
  }

  get(): AppState {
    return this.state
  }

  set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch }
    this.emit('change', this.state)
  }

  refreshPermissions(): void {
    this.set({ permissions: getPermissions() })
  }
}
