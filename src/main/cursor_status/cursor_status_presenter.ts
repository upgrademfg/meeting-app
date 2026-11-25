import type { AppState, CursorStatusView } from '../../shared/types'

const MESSAGE_MS = 4000

export interface CursorStatusDisplay {
  show(view: CursorStatusView): void
  hide(): void
}

export class CursorStatusPresenter {
  private previous?: AppState
  private current?: AppState
  private messages: CursorStatusView[] = []
  private messageTimer?: NodeJS.Timeout

  constructor(private readonly display: CursorStatusDisplay) {}

  update(state: AppState): void {
    const previous = this.previous
    this.previous = state
    this.current = state
    this.messages.push(...this.newMessages(previous, state))
    this.render()
  }

  private newMessages(previous: AppState | undefined, state: AppState): CursorStatusView[] {
    const messages: CursorStatusView[] = []
    const seen = new Set(previous?.warnings ?? [])
    for (const warning of state.warnings) {
      if (!seen.has(warning)) messages.push({ tone: 'warning', text: warning })
    }
    if (state.error && state.error !== previous?.error) messages.push({ tone: 'error', text: state.error })
    const saved = previous?.status === 'finalizing' && state.status === 'idle' && !state.error && state.lastFile
    if (saved) messages.push({ tone: 'success', text: '저장 완료' })
    return messages
  }

  private baseView(state: AppState): CursorStatusView | undefined {
    switch (state.status) {
      case 'starting':
        return { tone: 'info', text: '녹화 준비 중…' }
      case 'recording':
        return { tone: 'recording', text: '녹화 중', startedAt: state.startedAt }
      case 'finalizing':
        return { tone: 'info', text: '저장 중…' }
      case 'idle':
        return undefined
    }
  }

  private render(): void {
    const message = this.messages[0]
    const view = message ?? (this.current && this.baseView(this.current))
    if (view) this.display.show(view)
    else this.display.hide()
    if (message && !this.messageTimer) {
      this.messageTimer = setTimeout(() => {
        this.messageTimer = undefined
        this.messages.shift()
        this.render()
      }, MESSAGE_MS)
    }
  }
}
