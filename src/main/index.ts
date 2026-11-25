import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell, Tray } from 'electron'
import { join } from 'node:path'
import type { AppState, PermissionKind } from '../shared/types'
import { openPermissionSettings, requestPermissions } from './permissions'
import { RecordingService } from './recording/recording_service'
import { saveSettings } from './settings'
import { StateStore } from './state'

const isMac = process.platform === 'darwin'

if (isMac) {
  app.commandLine.appendSwitch('enable-features', 'MacLoopbackAudioForScreenShare,MacSckSystemAudioLoopbackOverride')
}

if (!app.requestSingleInstanceLock()) app.quit()

const store = new StateStore()
let controlWindow: BrowserWindow | undefined
let recorderWindow: BrowserWindow | undefined
let tray: Tray | undefined
let quitting = false

const preload = join(__dirname, '../preload/index.js')
const resource = (name: string): string => join(app.getAppPath(), 'resources', name)

function loadPage(win: BrowserWindow, page: 'index' | 'recorder'): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) void win.loadURL(`${devUrl}/${page}.html`)
  else void win.loadFile(join(__dirname, `../renderer/${page}.html`))
}

function showControlWindow(): void {
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.show()
    controlWindow.focus()
    return
  }
  controlWindow = new BrowserWindow({
    width: 380,
    height: 560,
    resizable: false,
    title: 'Meeting Recorder',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    webPreferences: { preload }
  })
  controlWindow.on('focus', () => store.refreshPermissions())
  controlWindow.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      controlWindow?.hide()
    }
  })
  loadPage(controlWindow, 'index')
}

function getRecorderWindow(): BrowserWindow {
  if (recorderWindow && !recorderWindow.isDestroyed()) return recorderWindow
  recorderWindow = new BrowserWindow({
    show: false,
    webPreferences: { preload, backgroundThrottling: false }
  })
  loadPage(recorderWindow, 'recorder')
  return recorderWindow
}

const recording = new RecordingService(getRecorderWindow, store)

function formatElapsed(startedAt?: number): string {
  if (!startedAt) return ''
  const s = Math.floor((Date.now() - startedAt) / 1000)
  const hh = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`
}

function updateTray(state: AppState, rebuildMenu = true): void {
  if (!tray) return
  const recordingNow = state.status === 'recording'
  const icon = nativeImage.createFromPath(resource(recordingNow ? 'tray_rec.png' : 'tray_idle.png'))
  if (!recordingNow) icon.setTemplateImage(true)
  tray.setImage(icon)
  const label = recordingNow ? `녹화 중 ${formatElapsed(state.startedAt)}` : state.status === 'finalizing' ? '저장 중…' : ''
  if (isMac) tray.setTitle(recordingNow ? ` ${formatElapsed(state.startedAt)}` : '')
  tray.setToolTip(label ? `Meeting Recorder — ${label}` : 'Meeting Recorder')
  if (!rebuildMenu) return
  tray.setContextMenu(
    Menu.buildFromTemplate([
      recordingNow
        ? { label: '회의 종료', click: () => void recording.stop() }
        : { label: '회의 시작', enabled: state.status === 'idle', click: () => void recording.start() },
      { type: 'separator' },
      { label: '창 열기', click: showControlWindow },
      {
        label: '저장 폴더 열기',
        enabled: !!state.outputDir,
        click: () => void shell.openPath(state.outputDir!)
      },
      { type: 'separator' },
      { label: '종료', click: () => app.quit() }
    ])
  )
}

function broadcast(state: AppState): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('app:state', state)
  updateTray(state)
}

function registerIpc(): void {
  ipcMain.handle('app:get-state', () => {
    store.refreshPermissions()
    return store.get()
  })
  ipcMain.handle('rec:start', () => recording.start())
  ipcMain.handle('rec:stop', () => recording.stop())
  ipcMain.handle('settings:choose-output-dir', async () => {
    const result = await dialog.showOpenDialog({
      title: '녹화 파일 저장 폴더',
      defaultPath: store.get().outputDir ?? app.getPath('videos'),
      properties: ['openDirectory', 'createDirectory']
    })
    const dir = result.filePaths[0]
    if (result.canceled || !dir) return
    saveSettings({ outputDir: dir })
    store.set({ outputDir: dir, error: undefined })
  })
  ipcMain.handle('settings:open-output-dir', () => {
    const dir = store.get().outputDir
    if (dir) void shell.openPath(dir)
  })
  ipcMain.handle('shell:reveal', (_e, path: string) => shell.showItemInFolder(path))
  ipcMain.handle('permissions:request', async () => {
    await requestPermissions()
    store.refreshPermissions()
  })
  ipcMain.handle('permissions:open-settings', (_e, kind: PermissionKind) => openPermissionSettings(kind))
}

app.on('second-instance', showControlWindow)
app.on('activate', showControlWindow)
app.on('window-all-closed', () => {})

app.on('before-quit', (e) => {
  if (quitting) return
  const { status } = store.get()
  if (status === 'recording' || status === 'finalizing') {
    e.preventDefault()
    void recording.stop().finally(() => {
      quitting = true
      app.quit()
    })
    return
  }
  quitting = true
})

void app.whenReady().then(() => {
  registerIpc()
  tray = new Tray(nativeImage.createEmpty())
  store.on('change', broadcast)
  setInterval(() => {
    if (store.get().status === 'recording') updateTray(store.get(), false)
  }, 1000)
  updateTray(store.get())

  getRecorderWindow()
  showControlWindow()
  void recording.recoverPending()
})
