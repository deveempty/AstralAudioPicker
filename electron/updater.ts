import { app, BrowserWindow, ipcMain } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater
const UPDATE_API_KEY = 'ASTRAL-BOmJvsjXIF1YZchNnLuGCMi6'

export type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'migrating' | 'error' | 'development'
export interface UpdateStatus {
  phase: UpdatePhase
  version?: string
  progress?: number
  message?: string
}

let updateWindow: BrowserWindow | null = null
let initialized = false
let currentStatus: UpdateStatus = { phase: 'idle' }

function publish(status: UpdateStatus) {
  currentStatus = status
  if (updateWindow && !updateWindow.isDestroyed()) updateWindow.webContents.send('picker-update-status', status)
}

export function publishMigrationStatus(status: UpdateStatus) {
  publish(status)
}

export function attachUpdaterWindow(browserWindow: BrowserWindow) {
  updateWindow = browserWindow
}

export async function checkForPickerUpdates(): Promise<boolean> {
  if (!app.isPackaged) {
    publish({ phase: 'development' })
    return false
  }
  publish({ phase: 'checking' })
  try {
    await autoUpdater.checkForUpdates()
    return true
  } catch (error) {
    publish({ phase: 'error', message: error instanceof Error ? error.message : String(error) })
    return false
  }
}

export function initializeAutoUpdater(browserWindow: BrowserWindow) {
  attachUpdaterWindow(browserWindow)
  if (initialized) return
  initialized = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.requestHeaders = { 'X-Audio-API-Key': UPDATE_API_KEY }
  autoUpdater.on('checking-for-update', () => publish({ phase: 'checking' }))
  autoUpdater.on('update-available', info => publish({ phase: 'available', version: info.version }))
  autoUpdater.on('update-not-available', info => publish({ phase: 'up-to-date', version: info.version }))
  autoUpdater.on('download-progress', progress => publish({ phase: 'downloading', progress: Math.round(progress.percent) }))
  autoUpdater.on('update-downloaded', info => publish({ phase: 'downloaded', version: info.version, progress: 100 }))
  autoUpdater.on('error', error => publish({ phase: 'error', message: error.message }))

  if (app.isPackaged) setTimeout(() => { void checkForPickerUpdates() }, 3500)
}

ipcMain.handle('get-picker-update-status', () => currentStatus)
ipcMain.handle('check-picker-updates', () => checkForPickerUpdates())
ipcMain.handle('install-picker-update', () => {
  if (currentStatus.phase !== 'downloaded') return false
  autoUpdater.quitAndInstall(false, true)
  return true
})
