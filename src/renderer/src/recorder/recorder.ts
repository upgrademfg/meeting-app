import type { CaptureLayout, RecorderStartConfig } from '../../../shared/types'


const CHUNK_MS = 1000
const MIME_CANDIDATES = [
  'video/webm;codecs=h264,opus',
  'video/webm;codecs=avc1,opus',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm'
]

let recorder: MediaRecorder | undefined
let cleanups: Array<() => void> = []

function cleanup(): void {
  for (const fn of cleanups.reverse()) fn()
  cleanups = []
  recorder = undefined
}

function hold(stream: MediaStream): MediaStream {
  cleanups.push(() => stream.getTracks().forEach((t) => t.stop()))
  return stream
}

async function capturePrimary(width: number, height: number, fps: number): Promise<MediaStream> {
  const video = { width: { ideal: width }, height: { ideal: height }, frameRate: { ideal: fps } }
  try {
    return hold(await navigator.mediaDevices.getDisplayMedia({ video, audio: true }))
  } catch {
    return hold(await navigator.mediaDevices.getDisplayMedia({ video, audio: false }))
  }
}

async function captureScreen(sourceId: string, fps: number): Promise<MediaStreamTrack> {
  const constraints = {
    audio: false,
    video: {
      mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId, maxFrameRate: fps }
    }
  } as unknown as MediaStreamConstraints
  const stream = hold(await navigator.mediaDevices.getUserMedia(constraints))
  return stream.getVideoTracks()[0]
}

async function captureMic(): Promise<MediaStream | undefined> {
  try {
    return hold(
      await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      })
    )
  } catch {
    return undefined
  }
}

function composite(layout: CaptureLayout, tracks: Map<string, MediaStreamTrack>, fps: number): MediaStreamTrack {
  const canvas = document.createElement('canvas')
  canvas.width = layout.width
  canvas.height = layout.height
  const ctx = canvas.getContext('2d', { alpha: false })!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const sources = layout.screens.map((region) => {
    const video = document.createElement('video')
    video.muted = true
    video.srcObject = new MediaStream([tracks.get(region.sourceId)!])
    void video.play()
    return { video, region }
  })

  const timer = setInterval(() => {
    for (const { video, region } of sources) {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        ctx.drawImage(video, region.x, region.y, region.width, region.height)
      }
    }
  }, 1000 / fps)

  const out = canvas.captureStream(fps).getVideoTracks()[0]
  cleanups.push(() => {
    clearInterval(timer)
    out.stop()
    for (const { video } of sources) video.srcObject = null
  })
  return out
}

function mixAudio(streams: MediaStream[]): MediaStreamTrack | undefined {
  const withAudio = streams.filter((s) => s.getAudioTracks().length > 0)
  if (withAudio.length === 0) return undefined
  const ctx = new AudioContext()
  const dest = ctx.createMediaStreamDestination()
  for (const s of withAudio) ctx.createMediaStreamSource(new MediaStream(s.getAudioTracks())).connect(dest)
  cleanups.push(() => void ctx.close())
  return dest.stream.getAudioTracks()[0]
}

async function start(config: RecorderStartConfig): Promise<void> {
  const { layout, fps } = config
  const [primary, ...others] = layout.screens

  const display = await capturePrimary(primary.width, primary.height, fps)
  const screenTracks = new Map<string, MediaStreamTrack>([[primary.sourceId, display.getVideoTracks()[0]]])
  for (const region of others) screenTracks.set(region.sourceId, await captureScreen(region.sourceId, fps))
  const mic = await captureMic()

  const videoTrack = others.length === 0 ? display.getVideoTracks()[0] : composite(layout, screenTracks, fps)
  const audioTrack = mixAudio(mic ? [display, mic] : [display])
  const stream = new MediaStream(audioTrack ? [videoTrack, audioTrack] : [videoTrack])

  const mimeType = MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
  const rec = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: config.videoBitsPerSecond,
    audioBitsPerSecond: 128_000
  })
  recorder = rec

  let queue = Promise.resolve()
  rec.ondataavailable = (e) => {
    if (e.data.size === 0) return
    queue = queue.then(async () => window.api.recorderChunk(new Uint8Array(await e.data.arrayBuffer())))
  }
  rec.onstart = () =>
    window.api.recorderStarted({
      mimeType: rec.mimeType || mimeType,
      hasSystemAudio: display.getAudioTracks().length > 0,
      hasMic: !!mic
    })
  rec.onstop = () => {
    void queue.then(() => {
      cleanup()
      window.api.recorderStopped()
    })
  }
  rec.onerror = (e) => window.api.recorderError(`MediaRecorder 오류: ${String((e as ErrorEvent).error ?? e.type)}`)

  for (const track of screenTracks.values()) {
    track.addEventListener('ended', () => {
      if (rec.state !== 'inactive') rec.stop()
    })
  }

  rec.start(CHUNK_MS)
}

window.api.onRecorderStart((config) => {
  if (recorder) return
  start(config).catch((e: unknown) => {
    cleanup()
    window.api.recorderError(e instanceof Error ? `${e.name}: ${e.message}` : String(e))
  })
})

window.api.onRecorderStop(() => {
  if (recorder && recorder.state !== 'inactive') recorder.stop()
  else {
    cleanup()
    window.api.recorderStopped()
  }
})
