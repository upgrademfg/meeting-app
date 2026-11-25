import { desktopCapturer, shell, systemPreferences } from 'electron'
import type { PermissionKind, PermissionState, PermissionStatus } from '../shared/types'

const isMac = process.platform === 'darwin'

export function getPermissions(): PermissionState {
  const mic = systemPreferences.getMediaAccessStatus('microphone') as PermissionStatus
  if (!isMac) {
    return { platform: process.platform, screen: 'granted', microphone: mic, accessibility: true }
  }
  return {
    platform: process.platform,
    screen: systemPreferences.getMediaAccessStatus('screen') as PermissionStatus,
    microphone: mic,
    accessibility: systemPreferences.isTrustedAccessibilityClient(false)
  }
}

export async function requestPermissions(): Promise<void> {
  if (!isMac) return
  if (systemPreferences.getMediaAccessStatus('microphone') === 'not-determined') {
    await systemPreferences.askForMediaAccess('microphone')
  }
  if (systemPreferences.getMediaAccessStatus('screen') !== 'granted') {
    await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } })
  }
  systemPreferences.isTrustedAccessibilityClient(true)
}

const MAC_PANES: Record<PermissionKind, string> = {
  screen: 'Privacy_ScreenCapture',
  microphone: 'Privacy_Microphone',
  accessibility: 'Privacy_Accessibility'
}

export async function openPermissionSettings(kind: PermissionKind): Promise<void> {
  if (isMac) {
    await shell.openExternal(`x-apple.systempreferences:com.apple.preference.security?${MAC_PANES[kind]}`)
  } else if (process.platform === 'win32' && kind === 'microphone') {
    await shell.openExternal('ms-settings:privacy-microphone')
  }
}
