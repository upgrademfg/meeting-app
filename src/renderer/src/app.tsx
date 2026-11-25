import { useEffect, useState } from 'react'
import type { AppState, PermissionKind, PermissionStatus } from '../../shared/types'

function useAppState(): AppState | undefined {
  const [state, setState] = useState<AppState>()
  useEffect(() => {
    void window.api.getState().then(setState)
    return window.api.onState(setState)
  }, [])
  return state
}

function useElapsed(startedAt?: number): string {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!startedAt) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [startedAt])
  if (!startedAt) return '00:00'
  const s = Math.max(0, Math.floor((now - startedAt) / 1000))
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return s >= 3600 ? `${Math.floor(s / 3600)}:${mm}:${ss}` : `${mm}:${ss}`
}

const PERMISSION_ROWS: Array<{ kind: PermissionKind; label: string; hint: string }> = [
  { kind: 'screen', label: '화면 녹화', hint: '화면과 시스템 사운드' },
  { kind: 'microphone', label: '마이크', hint: '내 목소리' },
  { kind: 'accessibility', label: '손쉬운 사용', hint: '마우스·파일 열기 기록' }
]

function Permissions({ state }: { state: AppState }): React.JSX.Element | null {
  const { permissions } = state
  const status = (kind: PermissionKind): PermissionStatus =>
    kind === 'accessibility' ? (permissions.accessibility ? 'granted' : 'denied') : permissions[kind]
  const missing = PERMISSION_ROWS.filter((r) => status(r.kind) !== 'granted')
  if (permissions.platform !== 'darwin' || missing.length === 0) return null

  return (
    <section className="card">
      <h2>권한이 필요합니다</h2>
      <ul className="perm-list">
        {missing.map((row) => (
          <li key={row.kind}>
            <div>
              <strong>{row.label}</strong>
              <span className="muted">{row.hint}</span>
            </div>
            <button className="link" onClick={() => void window.api.openPermissionSettings(row.kind)}>
              설정 열기
            </button>
          </li>
        ))}
      </ul>
      <button className="secondary" onClick={() => void window.api.requestPermissions()}>
        권한 요청하기
      </button>
      <p className="muted small">화면 녹화 권한은 허용 후 앱을 다시 실행해야 적용됩니다.</p>
    </section>
  )
}

export function App(): React.JSX.Element {
  const state = useAppState()
  const elapsed = useElapsed(state?.status === 'recording' ? state.startedAt : undefined)
  if (!state) return <main />

  const { status, outputDir } = state
  const busy = status === 'starting' || status === 'finalizing'
  const recording = status === 'recording'

  return (
    <main>
      <header className="titlebar">Meeting Recorder</header>

      <section className="hero">
        <div className={`timer ${recording ? 'live' : ''}`}>
          {recording && <span className="dot" />}
          {elapsed}
        </div>
        <p className="muted">
          {status === 'idle' && '모든 모니터 · 시스템 사운드 · 마이크'}
          {status === 'starting' && '녹화 준비 중…'}
          {status === 'recording' && '녹화 중 — 창을 닫아도 계속 녹화됩니다'}
          {status === 'finalizing' && 'MP4 파일로 저장하는 중…'}
        </p>
        <button
          className={recording ? 'primary stop' : 'primary'}
          disabled={busy || (!recording && !outputDir)}
          onClick={() => void (recording ? window.api.stopRecording() : window.api.startRecording())}
        >
          {recording ? '회의 종료' : busy ? '잠시만요…' : '회의 시작'}
        </button>
      </section>

      {state.error && <div className="alert error">{state.error}</div>}
      {state.warnings.map((w) => (
        <div key={w} className="alert warn">
          {w}
        </div>
      ))}

      {state.lastFile && status === 'idle' && (
        <div className="alert ok">
          <span>저장됨: {state.lastFile.split(/[\\/]/).pop()}</span>
          <button className="link" onClick={() => void window.api.revealFile(state.lastFile!)}>
            보기
          </button>
        </div>
      )}

      <section className="card">
        <h2>저장 폴더</h2>
        <p className={`path ${outputDir ? '' : 'muted'}`}>{outputDir ?? '아직 지정하지 않았습니다'}</p>
        <div className="row">
          <button className="secondary" disabled={recording || busy} onClick={() => void window.api.chooseOutputDir()}>
            {outputDir ? '변경' : '폴더 지정'}
          </button>
          {outputDir && (
            <button className="link" onClick={() => void window.api.openOutputDir()}>
              폴더 열기
            </button>
          )}
        </div>
      </section>

      <Permissions state={state} />
    </main>
  )
}
