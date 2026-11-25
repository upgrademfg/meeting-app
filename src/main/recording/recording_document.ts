import { readFileSync, writeFileSync } from 'node:fs'

const FORMAT_VERSION = 2

export interface RecordingInfo {
  video: string
  platform: string
  width: number
  height: number
  screens: Array<{ displayId: string; x: number; y: number; width: number; height: number }>
  mimeType: string
  hasSystemAudio: boolean
  hasMic: boolean
  startedAt: string
}

interface LoggedEvent {
  offsetMs: number
}

export function writeRecordingDocument(
  path: string,
  info: RecordingInfo,
  eventLogPath: string,
  endedAt: string | undefined
): void {
  const document = {
    version: FORMAT_VERSION,
    ...info,
    endedAt,
    recovered: endedAt === undefined,
    events: readEventLog(eventLogPath)
  }
  writeFileSync(path, JSON.stringify(document, null, 2))
}

function readEventLog(path: string): LoggedEvent[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .flatMap(parseLine)
    .sort((a, b) => a.offsetMs - b.offsetMs)
}

// 녹화 중 강제 종료되면 마지막 줄이 쓰다 만 채로 남을 수 있다
function parseLine(line: string): LoggedEvent[] {
  try {
    return line ? [JSON.parse(line) as LoggedEvent] : []
  } catch {
    return []
  }
}
