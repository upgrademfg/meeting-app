import type { CursorStatusView } from '../../../shared/types'
import './cursor_status.css'

const badge = document.querySelector<HTMLDivElement>('.badge')!
const text = badge.querySelector<HTMLSpanElement>('.text')!
const time = badge.querySelector<HTMLSpanElement>('.time')!

let view: CursorStatusView | undefined

function elapsed(startedAt: number): string {
  const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return s >= 3600 ? `${Math.floor(s / 3600)}:${mm}:${ss}` : `${mm}:${ss}`
}

function renderTime(): void {
  time.textContent = view?.startedAt ? elapsed(view.startedAt) : ''
}

window.api.onCursorStatus((next, align) => {
  view = next
  badge.dataset.tone = next.tone
  text.textContent = next.text
  document.body.classList.toggle('align-right', align === 'right')
  renderTime()
  badge.hidden = false
})

setInterval(renderTime, 500)
