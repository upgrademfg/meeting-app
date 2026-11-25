import { systemPreferences } from 'electron'
import type { CaptureLayout } from '../../shared/types'
import { MouseActivityTracker } from './application/mouse_activity_tracker'
import { WindowActivityTracker } from './application/window_activity_tracker'
import { ElectronVideoProjection } from './infrastructure/electron_video_projection'
import { JsonlActivityLog } from './infrastructure/jsonl_activity_log'
import { MacWindowContextResolver } from './infrastructure/mac_window_context_resolver'
import { NativeWindowSource } from './infrastructure/native_window_source'
import { UiohookMouseSource } from './infrastructure/uiohook_mouse_source'
import { WinRecentFiles } from './infrastructure/win_recent_files'
import { WinWindowContextResolver } from './infrastructure/win_window_context_resolver'
import type { WindowContextResolver } from './ports/window_context_resolver'

export interface ActivityTrackingOptions {
  layout: CaptureLayout
  logPath: string
  warnings: string[]
}

export interface ActivityTracking {
  startedAt: string
  warnings: string[]
  stop(): Promise<void>
}

function contextResolver(recentFiles: WinRecentFiles | undefined): WindowContextResolver {
  if (process.platform === 'darwin') return new MacWindowContextResolver()
  if (recentFiles) return new WinWindowContextResolver(recentFiles)
  return { resolve: async () => ({}) }
}

export function startActivityTracking(options: ActivityTrackingOptions): ActivityTracking {
  const log = new JsonlActivityLog(options.logPath)
  const projection = new ElectronVideoProjection(options.layout)
  const warnings = [...options.warnings]
  const trusted = process.platform !== 'darwin' || systemPreferences.isTrustedAccessibilityClient(false)
  if (!trusted) warnings.push('손쉬운 사용 권한이 없어 마우스 입력과 창 제목·위치·문서를 기록하지 않습니다.')

  const recentFiles = process.platform === 'win32' ? new WinRecentFiles() : undefined
  recentFiles?.start()

  const windows = new WindowActivityTracker(new NativeWindowSource(), contextResolver(recentFiles), projection, log)
  if (!windows.start()) warnings.push('창 전환 이벤트를 받을 수 없습니다.')

  const mouse = trusted ? new MouseActivityTracker(new UiohookMouseSource(), projection, log) : undefined
  mouse?.start()

  for (const message of warnings) log.record({ type: 'warning', message })

  return {
    startedAt: log.startedAt,
    warnings,
    async stop() {
      mouse?.stop()
      await windows.stop()
      recentFiles?.stop()
      await log.close()
    }
  }
}
