import { desktopCapturer, screen, type DesktopCapturerSource } from 'electron'
import type { CaptureLayout } from '../../shared/types'

const MAX_WIDTH = 3840
const MAX_HEIGHT = 2160

const even = (n: number): number => Math.max(2, Math.round(n / 2) * 2)

export async function buildCaptureLayout(): Promise<{
  layout: CaptureLayout
  primarySource: DesktopCapturerSource
}> {
  const primaryId = screen.getPrimaryDisplay().id
  const displays = screen
    .getAllDisplays()
    .sort((a, b) => Number(b.id === primaryId) - Number(a.id === primaryId))
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 0, height: 0 }
  })
  if (sources.length === 0) throw new Error('캡처할 화면을 찾지 못했습니다. 화면 녹화 권한을 확인하세요.')

  const originX = Math.min(...displays.map((d) => d.bounds.x))
  const originY = Math.min(...displays.map((d) => d.bounds.y))
  const boxWidth = Math.max(...displays.map((d) => d.bounds.x + d.bounds.width)) - originX
  const boxHeight = Math.max(...displays.map((d) => d.bounds.y + d.bounds.height)) - originY
  const sharpest = Math.max(...displays.map((d) => d.scaleFactor))
  const scale = Math.min(sharpest, MAX_WIDTH / boxWidth, MAX_HEIGHT / boxHeight)

  const matched = displays.map((display, i) => {
    const source = sources.find((s) => s.display_id === String(display.id)) ?? sources[i]
    if (!source) throw new Error(`모니터 ${display.id}의 캡처 소스를 찾지 못했습니다.`)
    return { display, source }
  })

  const layout: CaptureLayout = {
    width: even(boxWidth * scale),
    height: even(boxHeight * scale),
    scale,
    originX,
    originY,
    screens: matched.map(({ display, source }) => ({
      sourceId: source.id,
      displayId: String(display.id),
      x: Math.round((display.bounds.x - originX) * scale),
      y: Math.round((display.bounds.y - originY) * scale),
      width: even(display.bounds.width * scale),
      height: even(display.bounds.height * scale)
    }))
  }
  return { layout, primarySource: matched[0].source }
}

export function videoBitrateFor(layout: CaptureLayout, fps: number): number {
  const bps = layout.width * layout.height * fps * 0.07
  return Math.round(Math.min(20_000_000, Math.max(3_000_000, bps)))
}
