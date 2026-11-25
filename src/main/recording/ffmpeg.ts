import { spawn } from 'node:child_process'
import ffmpegStatic from 'ffmpeg-static'

function ffmpegPath(): string {
  if (!ffmpegStatic) throw new Error('이 플랫폼용 ffmpeg 바이너리가 없습니다.')
  return ffmpegStatic.replace('app.asar', 'app.asar.unpacked')
}

export function convertToMp4(input: string, output: string, videoIsH264: boolean): Promise<void> {
  const video = videoIsH264
    ? ['-c:v', 'copy']
    : process.platform === 'darwin'
      ? ['-c:v', 'h264_videotoolbox', '-b:v', '8M']
      : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23']

  const args = [
    '-hide_banner',
    '-y',
    '-fflags', '+genpts',
    '-i', input,
    ...video,
    '-c:a', 'aac',
    '-b:a', '160k',
    '-movflags', '+faststart',
    output
  ]

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath(), args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    proc.stderr.on('data', (d: Buffer) => {
      stderr = (stderr + d.toString()).slice(-4000)
    })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg 변환 실패 (code ${code})\n${stderr}`))
    })
  })
}
