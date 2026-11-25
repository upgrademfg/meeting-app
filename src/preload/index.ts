import { contextBridge, ipcRenderer } from 'electron'
import type { Api, AppState, RecorderStartConfig } from '../shared/types'

const api: Api = {
  getState: () => ipcRenderer.invoke('app:get-state'),
  onState: (cb) => {
    const listener = (_e: unknown, state: AppState): void => cb(state)
    ipcRenderer.on('app:state', listener)
    return () => ipcRenderer.removeListener('app:state', listener)
  },
  startRecording: () => ipcRenderer.invoke('rec:start'),
  stopRecording: () => ipcRenderer.invoke('rec:stop'),
  chooseOutputDir: () => ipcRenderer.invoke('settings:choose-output-dir'),
  openOutputDir: () => ipcRenderer.invoke('settings:open-output-dir'),
  revealFile: (path) => ipcRenderer.invoke('shell:reveal', path),
  requestPermissions: () => ipcRenderer.invoke('permissions:request'),
  openPermissionSettings: (kind) => ipcRenderer.invoke('permissions:open-settings', kind),

  onRecorderStart: (cb) => {
    ipcRenderer.on('recorder:start', (_e, config: RecorderStartConfig) => cb(config))
  },
  onRecorderStop: (cb) => {
    ipcRenderer.on('recorder:stop', () => cb())
  },
  recorderStarted: (info) => ipcRenderer.send('recorder:started', info),
  recorderChunk: (data) => ipcRenderer.send('recorder:chunk', data),
  recorderStopped: () => ipcRenderer.send('recorder:stopped'),
  recorderError: (message) => ipcRenderer.send('recorder:error', message),

  onCursorClick: (cb) => {
    ipcRenderer.on('cursor:click', () => cb())
  }
}

contextBridge.exposeInMainWorld('api', api)
