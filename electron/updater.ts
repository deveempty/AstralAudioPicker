import path from 'node:path'
import {RequiredUpdatePolicy} from './required-update'
import { app, BrowserWindow, ipcMain } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater
const UPDATE_API_KEY = 'ASTRAL-BOmJvsjXIF1YZchNnLuGCMi6'

export type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'migrating' | 'error' | 'development'
export interface UpdateStatus {
  required?: boolean
  minimumVersion?: string
  phase: UpdatePhase
  version?: string
  progress?: number
  message?: string
}

let updateWindow: BrowserWindow | null = null
let initialized = false
let currentStatus: UpdateStatus = { phase: 'idle' }
let policy: RequiredUpdatePolicy | undefined
let checked = false
let checking: Promise<boolean> | undefined
export function pickerUpdateBlocked() { return app.isPackaged && (!checked || !!policy?.required) }

function publish(status: UpdateStatus) {
  currentStatus = {...status, required:policy?.required ?? false, minimumVersion:policy?.minimumVersion}
  status = currentStatus
  if (updateWindow && !updateWindow.isDestroyed()) updateWindow.webContents.send('picker-update-status', status)
}

export function publishMigrationStatus(status: UpdateStatus) {
  publish(status)
}

export function attachUpdaterWindow(browserWindow: BrowserWindow) {
  updateWindow = browserWindow
}

async function performCheck(): Promise<boolean> {
  if(app.isPackaged&&!initialized){publish({phase:'checking'});return false}
  if (!app.isPackaged) {
    publish({ phase: 'development' })
    return false
  }
  publish({ phase: 'checking' })
  try {
    await autoUpdater.checkForUpdates()
    checked=true
    return true
  } catch (error) {
    checked=true
    publish({ phase: 'error', message: error instanceof Error ? error.message : String(error) })
    return false
  }
}

export function checkForPickerUpdates(): Promise<boolean> { return checking ??= performCheck().finally(()=>{checking=undefined}) }

export function initializeAutoUpdater(browserWindow: BrowserWindow) {
  attachUpdaterWindow(browserWindow)
  if (initialized) return
  initialized = true
  if(app.isPackaged)policy=new RequiredUpdatePolicy(path.join(app.getPath('userData'),'required-update.json'),app.getVersion())

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.requestHeaders = { 'X-Audio-API-Key': UPDATE_API_KEY }
  autoUpdater.on('checking-for-update', () => publish({ phase: 'checking' }))
  const accept = (info: {version:string; minimumVersion?:string}) => { policy?.accept(info.version,info.minimumVersion); checked=true }
  autoUpdater.on('update-available', info => { accept(info); publish({ phase: 'available', version: info.version }) })
  autoUpdater.on('update-not-available', info => { accept(info); publish({ phase: 'up-to-date', version: info.version }) })
  autoUpdater.on('download-progress', progress => publish({ phase: 'downloading', version: currentStatus.version, progress: Math.round(progress.percent) }))
  autoUpdater.on('update-downloaded', info => publish({ phase: 'downloaded', version: info.version, progress: 100 }))
  autoUpdater.on('error', error => publish({ phase: 'error', message: error.message }))

  if (app.isPackaged) setTimeout(() => { void checkForPickerUpdates() }, 3500)
}

ipcMain.handle('get-picker-update-status', () => ({...currentStatus,required:policy?.required ?? false,minimumVersion:policy?.minimumVersion}))
ipcMain.handle('check-picker-updates', () => checkForPickerUpdates())
ipcMain.handle('install-picker-update', () => {
  if (currentStatus.phase !== 'downloaded') return false
  autoUpdater.quitAndInstall(false, true)
  return true
})
