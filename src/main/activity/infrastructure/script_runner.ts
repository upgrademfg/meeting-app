import { execFile } from 'node:child_process'

export function runScript(command: string, args: string[], timeout = 3000): Promise<string> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout, windowsHide: true }, (err, stdout) => {
      resolve(err ? '' : stdout.trim())
    })
  })
}
