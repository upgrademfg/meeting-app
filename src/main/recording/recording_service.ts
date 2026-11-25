import { app, ipcMain, session, type BrowserWindow } from 'electron'
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, type WriteStream } from 'node:fs'
import { basename, join } from 'node:path'
import type { CaptureLayout, RecorderStartConfig, RecorderStartedInfo } from '../../shared/types'
import { startActivityTracking, type ActivityTracking } from '../activity'
import type { StateStore } from '../state'
import { convertToMp4 } from './ffmpeg'
import { buildCaptureLayout, videoBitrateFor } from './layout'
import { writeRecordingDocument, type RecordingInfo } from './recording_document'

const FPS = 30
const START_TIMEOUT_MS = 15_000
const STOP_TIMEOUT_MS = 10_000

interface Pending {
  webm: string
  mp4: string
  videoIsH264: boolean
  eventLog: string
  document: string
  info: RecordingInfo
}

interface ActiveRecording {
  layout: CaptureLayout
  paths: { webm: string; mp4: string; eventLog: string; document: string }
  writer: WriteStream
  pending?: Pending
  activity?: ActivityTracking
}

const pendingFile = (): string => join(app.getPath('userData'), 'pending-recording.json')

function timestampName(d = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))

export class RecordingService {
  private active?: ActiveRecording
  private startWaiter?: { resolve: (info: RecorderStartedInfo) => void; reject: (e: Error) => void }
  private stopWaiter?: () => void

  constructor(
    private readonly recorderWindow: () => BrowserWindow,
    private readonly store: StateStore
  ) {
    ipcMain.on('recorder:started', (_e, info: RecorderStartedInfo) => this.startWaiter?.resolve(info))
    ipcMain.on('recorder:chunk', (_e, data: Uint8Array) => {
      this.active?.writer.write(Buffer.from(data.buffer, data.byteOffset, data.byteLength))
    })
    ipcMain.on('recorder:stopped', () => {
      if (this.stopWaiter) this.stopWaiter()
      else if (this.store.get().status === 'recording') void this.stop(true)
    })
    ipcMain.on('recorder:error', (_e, msg: string) => {
      if (this.startWaiter) this.startWaiter.reject(new Error(msg))
      else this.store.set({ warnings: [...this.store.get().warnings, msg] })
    })
  }

  async start(): Promise<void> {
    const { status, outputDir } = this.store.get()
    if (status !== 'idle') return
    if (!outputDir) {
      this.store.set({ error: '저장 폴더를 먼저 지정하세요.' })
      return
    }
    this.store.set({ status: 'starting', error: undefined, warnings: [], lastFile: undefined })

    try {
      const { layout, primarySource } = await buildCaptureLayout()
      session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
        callback(request.audioRequested ? { video: primarySource, audio: 'loopback' } : { video: primarySource })
      })

      mkdirSync(outputDir, { recursive: true })
      const base = join(outputDir, timestampName())
      const paths = {
        webm: `${base}.recording.webm`,
        mp4: `${base}.mp4`,
        eventLog: `${base}.recording.jsonl`,
        document: `${base}.json`
      }
      this.active = { layout, paths, writer: createWriteStream(paths.webm) }

      const info = await this.waitForStart({
        layout,
        fps: FPS,
        videoBitsPerSecond: videoBitrateFor(layout, FPS)
      })
      this.onRecorderStarted(info)
    } catch (e) {
      await this.discardActive()
      this.store.set({ status: 'idle', error: `녹화를 시작하지 못했습니다: ${message(e)}` })
    }
  }

  async stop(recorderAlreadyStopped = false): Promise<void> {
    const active = this.active
    if (!active || this.store.get().status !== 'recording') return
    this.store.set({ status: 'finalizing' })

    const activityStopped = active.activity?.stop()
    if (!recorderAlreadyStopped) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, STOP_TIMEOUT_MS)
        this.stopWaiter = () => {
          clearTimeout(timer)
          resolve()
        }
        this.recorderWindow().webContents.send('recorder:stop')
      })
      this.stopWaiter = undefined
    }
    const endedAt = new Date().toISOString()

    await new Promise<void>((resolve) => active.writer.end(resolve))
    await activityStopped
    this.active = undefined
    if (active.pending) await this.finalize(active.pending, endedAt)
  }

  async recoverPending(): Promise<void> {
    if (!existsSync(pendingFile())) return
    const pending = JSON.parse(readFileSync(pendingFile(), 'utf8')) as Pending
    if (!existsSync(pending.webm)) {
      rmSync(pendingFile(), { force: true })
      return
    }
    this.store.set({ status: 'finalizing' })
    await this.finalize(pending)
  }

  private waitForStart(config: RecorderStartConfig): Promise<RecorderStartedInfo> {
    return new Promise<RecorderStartedInfo>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('녹화 창이 응답하지 않습니다.')), START_TIMEOUT_MS)
      this.startWaiter = {
        resolve: (info) => {
          clearTimeout(timer)
          resolve(info)
        },
        reject: (e) => {
          clearTimeout(timer)
          reject(e)
        }
      }
      this.recorderWindow().webContents.send('recorder:start', config)
    }).finally(() => {
      this.startWaiter = undefined
    })
  }

  private onRecorderStarted(info: RecorderStartedInfo): void {
    const active = this.active!
    const { layout, paths } = active

    const audioWarnings: string[] = []
    if (!info.hasSystemAudio) audioWarnings.push('시스템 사운드를 캡처하지 못했습니다. 상대방 목소리가 녹음되지 않습니다.')
    if (!info.hasMic) audioWarnings.push('마이크를 사용할 수 없습니다. 내 목소리가 녹음되지 않습니다.')

    active.activity = startActivityTracking({ layout, logPath: paths.eventLog, warnings: audioWarnings })

    active.pending = {
      webm: paths.webm,
      mp4: paths.mp4,
      videoIsH264: /h264|avc1/i.test(info.mimeType),
      eventLog: paths.eventLog,
      document: paths.document,
      info: {
        video: basename(paths.mp4),
        platform: process.platform,
        width: layout.width,
        height: layout.height,
        screens: layout.screens.map(({ displayId, x, y, width, height }) => ({ displayId, x, y, width, height })),
        mimeType: info.mimeType,
        hasSystemAudio: info.hasSystemAudio,
        hasMic: info.hasMic,
        startedAt: active.activity.startedAt
      }
    }
    writeFileSync(pendingFile(), JSON.stringify(active.pending))

    this.store.set({ status: 'recording', startedAt: Date.now(), warnings: active.activity.warnings })
  }

  private async finalize(pending: Pending, endedAt?: string): Promise<void> {
    if (existsSync(pending.eventLog)) {
      writeRecordingDocument(pending.document, pending.info, pending.eventLog, endedAt)
      rmSync(pending.eventLog)
    }
    try {
      await convertToMp4(pending.webm, pending.mp4, pending.videoIsH264)
      rmSync(pending.webm, { force: true })
      rmSync(pendingFile(), { force: true })
      this.store.set({ status: 'idle', startedAt: undefined, lastFile: pending.mp4 })
    } catch (e) {
      this.store.set({
        status: 'idle',
        startedAt: undefined,
        lastFile: pending.webm,
        error: `MP4 변환에 실패해 원본을 보존했습니다: ${message(e)}`
      })
    }
  }

  private async discardActive(): Promise<void> {
    const active = this.active
    this.active = undefined
    if (!active) return
    this.recorderWindow().webContents.send('recorder:stop')
    await active.activity?.stop()
    await new Promise<void>((resolve) => active.writer.end(resolve))
    rmSync(active.paths.webm, { force: true })
    rmSync(active.paths.eventLog, { force: true })
  }
}
