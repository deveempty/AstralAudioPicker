import {createPluginTransfer} from './plugin-transfer'
import {v5SlotIndex,setV5Route} from './v5-routing'
import {runDiagnostics} from './diagnostics'
import {audioLocalTest} from './local-test-mode'
import {createAudioAccess} from './audio-access'
import { CUSTOM_OUTPUT_DLL, customOutputActive, routeCustomOutput } from './custom-output'
import { PluginControlStore, pluginControlDirectory } from './plugin-control'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { exec, execFile } from 'node:child_process'
import { generateHeadphoneEqSet, getV5Readiness, listHeadphoneEqs, listV5Presets, resolveHeadphoneEq, resolveV5Preset, searchHeadphoneEqs } from './v5-presets'
import { LEGACY_DEVICE_NAME, MAIN_CONFIG_FILE, V5_DEVICE_NAME } from './astral-paths'
import { runPendingMigrations } from './migrations'
import { attachUpdaterWindow, initializeAutoUpdater, publishMigrationStatus } from './updater'

const CONFIG_PATH = 'C:\\Program Files\\EqualizerAPO\\config'
const CONFIG_FILE = path.join(CONFIG_PATH, 'config.txt')
const AT_V2_FILE = path.join(CONFIG_PATH, 'at_v2.txt')
const AIW_V3_FILE = path.join(CONFIG_PATH, 'aiw_v3.txt')

let audioAccess: ReturnType<typeof createAudioAccess>
let win: BrowserWindow | null = null

function createWindow() {
  win = new BrowserWindow({
    width: 1550,
    height: 1000,
    frame: false,
    transparent: true,
    minWidth: 1550,
    minHeight: 1000,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(async () => {
  audioAccess=createAudioAccess(CONFIG_FILE)
  createWindow()
  if (win) attachUpdaterWindow(win)
  win?.webContents.once('did-finish-load', async () => {
    if (audioLocalTest) { publishMigrationStatus({ phase: 'idle' }); return }
    publishMigrationStatus({ phase: 'migrating' })
    const migrationResult = await runPendingMigrations(() => publishMigrationStatus({ phase: 'migrating' }))
    if (!migrationResult.success) {
      publishMigrationStatus({ phase: 'error', message: `Audio migration failed: ${migrationResult.error ?? 'unknown'}` })
      return
    }
    publishMigrationStatus({ phase: 'idle' })
    if (win) initializeAutoUpdater(win)
  })
})
app.on('window-all-closed', () => app.quit())

// Window controls
ipcMain.on('minimize', () => win?.minimize())
ipcMain.on('close', () => win?.close())

// Config reading
interface ConfigState {
  mainConfig: 'none' | 'v1' | 'v2' | 'aiwv2' | 'aiwv5' | 'custom'
  v2Subs: { [key: string]: boolean }
}

function parseConfigLine(line: string): { enabled: boolean; include: string } | null {
  const trimmed = line.trim()
  const commented = trimmed.startsWith('#')
  const match = trimmed.match(/^#?\s*Include:\s*(.+)$/i)
  if (match) {
    return { enabled: !commented, include: match[1].trim() }
  }
  return null
}

function readConfigState(): ConfigState {
  const state: ConfigState = {
    mainConfig: 'none',
    v2Subs: { 'v2.1': false, 'v2.2': false, 'v2.3': false, 'v2.4': false, 'v2.5': false }
  }

  try {
    const pickerStateFile = path.join(app.getPath('userData'), 'picker-state.json')
    if (fs.existsSync(pickerStateFile)) {
      const saved = JSON.parse(fs.readFileSync(pickerStateFile, 'utf8')) as { mainConfig?: string }
      if (saved.mainConfig === 'aiwv5') state.mainConfig = 'aiwv5'
    }
    // Read main config.txt
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8')
      for (const line of content.split('\n')) {
        const parsed = parseConfigLine(line)
        if (parsed) {
          if (parsed.include.toLowerCase().includes('at_v1')) {
            if (parsed.enabled) state.mainConfig = 'v1'
          } else if (parsed.include.toLowerCase().includes('at_v2')) {
            if (parsed.enabled) state.mainConfig = 'v2'
          } else if (parsed.include.toLowerCase().includes('aiw_v3')) {
            if (parsed.enabled) state.mainConfig = 'aiwv2'
          }
        }
      }
    }

    // Read at_v2.txt for sub-configs
    if (fs.existsSync(AT_V2_FILE)) {
      const content = fs.readFileSync(AT_V2_FILE, 'utf-8')
      for (const line of content.split('\n')) {
        const parsed = parseConfigLine(line)
        if (parsed) {
          for (const key of Object.keys(state.v2Subs)) {
            if (parsed.include.toLowerCase().includes(key.toLowerCase())) {
              state.v2Subs[key] = parsed.enabled
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error reading config:', err)
  }

  try {
    const saved = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'picker-state.json'), 'utf8')) as { mainConfig?: string }
    if (saved.mainConfig === 'aiwv5') state.mainConfig = 'aiwv5'
  } catch {
    // First run has no persisted picker view yet.
  }

  if (fs.existsSync(CONFIG_FILE) && customOutputActive(fs.readFileSync(CONFIG_FILE,'utf8'))) state.mainConfig = 'custom'
  return state
}

ipcMain.handle('get-config-state', () => readConfigState())

// Update main config (config.txt)
function updateMainConfig(selection: 'none' | 'v1' | 'v2' | 'aiwv2' | 'aiwv5' | 'custom'): boolean {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return false

    const pickerStateFile = path.join(app.getPath('userData'), 'picker-state.json')
    fs.mkdirSync(path.dirname(pickerStateFile), { recursive: true })


    let content = routeCustomOutput(fs.readFileSync(CONFIG_FILE, 'utf-8'), false)
    const lines = content.split('\n')
    const newLines: string[] = []

    for (const line of lines) {
      const parsed = parseConfigLine(line)
      if (parsed) {
        const isV1 = parsed.include.toLowerCase().includes('at_v1')
        const isV2 = parsed.include.toLowerCase().includes('at_v2')
        const isObsoleteV3 = parsed.include.toLowerCase().includes('at_v3')
        const isAIWV2 = parsed.include.toLowerCase().includes('aiw_v3')

        if (isV1) {
          newLines.push(selection === 'v1' ? `Include: ${parsed.include}` : `# Include: ${parsed.include}`)
        } else if (isV2) {
          newLines.push(selection === 'v2' ? `Include: ${parsed.include}` : `# Include: ${parsed.include}`)
        } else if (isObsoleteV3) {
          newLines.push(`# Include: ${parsed.include}`)
        } else if (isAIWV2) {
          newLines.push(selection === 'aiwv2' ? `Include: ${parsed.include}` : `# Include: ${parsed.include}`)
        } else {
          newLines.push(line)
        }
      } else {
        newLines.push(line)
      }
    }

    fs.writeFileSync(CONFIG_FILE, routeCustomOutput(setV5Route(newLines.join('\n'),selection === 'aiwv5'), selection === 'custom'), 'utf-8')
    fs.writeFileSync(pickerStateFile, JSON.stringify({ mainConfig: selection }), 'utf8')
    return true
  } catch (err) {
    console.error('Error updating main config:', err)
    return false
  }
}

// Update V2 sub-config (at_v2.txt) - exclusive selection (only one active)
function updateV2Sub(selectedKey: string): boolean {
  try {
    if (!fs.existsSync(AT_V2_FILE)) return false

    const content = fs.readFileSync(AT_V2_FILE, 'utf-8')
    const lines = content.split('\n')
    const newLines: string[] = []
    const v2Keys = ['v2.1', 'v2.2', 'v2.3', 'v2.4', 'v2.5']

    for (const line of lines) {
      const parsed = parseConfigLine(line)
      if (parsed) {
        // Check if this line is one of the v2.x sub-configs
        const matchedKey = v2Keys.find(k => parsed.include.toLowerCase().includes(k.toLowerCase()))
        if (matchedKey) {
          // Enable only the selected one, disable all others
          const shouldEnable = matchedKey === selectedKey
          newLines.push(shouldEnable ? `Include: ${parsed.include}` : `# Include: ${parsed.include}`)
        } else {
          newLines.push(line)
        }
      } else {
        newLines.push(line)
      }
    }

    fs.writeFileSync(AT_V2_FILE, newLines.join('\n'), 'utf-8')
    return true
  } catch (err) {
    console.error('Error updating V2 sub-config:', err)
    return false
  }
}

let audioDeviceMutationQueue: Promise<unknown> = Promise.resolve()

function queueAudioDeviceMutation(task: () => Promise<boolean>): Promise<boolean> {
  const pending = audioDeviceMutationQueue.then(task, task)
  audioDeviceMutationQueue = pending.then(() => undefined, () => undefined)
  return pending
}

// Restart only the 7.1 legacy endpoint after changing AT V1/V2/AIW V3.
function restartHiFiCable(): Promise<boolean> {
  return queueAudioDeviceMutation(() => new Promise((resolve) => {
    const script = `
$device = Get-PnpDevice -Class AudioEndpoint | Where-Object { $_.FriendlyName -like '*${LEGACY_DEVICE_NAME}*' } | Select-Object -First 1
if ($device) {
  Disable-PnpDevice -InstanceId $device.InstanceId -Confirm:$false
  Start-Sleep -Milliseconds 500
  Enable-PnpDevice -InstanceId $device.InstanceId -Confirm:$false
  Write-Output "OK"
} else {
  Write-Output "NOT_FOUND"
}
`
    const tempScript = path.join(app.getPath('temp'), 'restart_hifi.ps1')
    require('fs').writeFileSync(tempScript, script)

    exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempScript}"`, { timeout: 12000, windowsHide: true }, (err, stdout) => {
      if (err) {
        console.error('Error restarting device:', err)
        resolve(false)
      } else {
        resolve(stdout.trim().includes('OK'))
      }
    })
  }))
}

// Restart audio service to apply registry changes (for loudness settings)
function restartAudioService(): Promise<boolean> {
  return new Promise((resolve) => {
    const script = `
Restart-Service audiosrv -Force
Write-Output "OK"
`
    const tempScript = path.join(app.getPath('temp'), 'restart_audio.ps1')
    require('fs').writeFileSync(tempScript, script)

    exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempScript}"`, (err, stdout) => {
      if (err) {
        console.error('Error restarting audio service:', err)
        resolve(false)
      } else {
        resolve(stdout.trim().includes('OK'))
      }
    })
  })
}

ipcMain.handle('set-main-config', async (_event, selection: 'none' | 'v1' | 'v2' | 'aiwv2' | 'aiwv5' | 'custom') => {
  if (!['none','v1','v2','aiwv2','aiwv5','custom'].includes(selection)) return {success:false,state:readConfigState(),code:'INVALID_PROFILE'}
  if (selection === 'custom') { try { await audioAccess.requireReady() } catch { return {success:false,state:readConfigState(),code:'LOGIN_REQUIRED'} } }
  if (selection === 'custom' && !fs.existsSync(CUSTOM_OUTPUT_DLL)) return {success:false,state:readConfigState(),code:'CUSTOM_OUTPUT_NOT_INSTALLED'}
  const previousConfig = fs.existsSync(CONFIG_FILE) ? fs.readFileSync(CONFIG_FILE,'utf8') : null
  const stateFile = path.join(app.getPath('userData'),'picker-state.json')
  const previousState = fs.existsSync(stateFile) ? fs.readFileSync(stateFile,'utf8') : null
  const success = updateMainConfig(selection)
  let routed = true

  if (success && selection !== 'none') {
    routed = await switchCableEndpoint(selection === 'aiwv5' || selection === 'custom' ? 'v5' : 'legacy')
    if (!routed && previousConfig !== null) {
      fs.writeFileSync(CONFIG_FILE,previousConfig,'utf8')
      if(previousState !== null) fs.writeFileSync(stateFile,previousState,'utf8')
      else if(fs.existsSync(stateFile)) fs.unlinkSync(stateFile)
    }
  }

  const state = readConfigState()
  if (success && routed && selection === 'aiwv5') state.mainConfig = 'aiwv5'
  return { success: success && routed, state, code: routed ? undefined : 'AUDIO_ENDPOINT_SWITCH_FAILED' }
})

ipcMain.handle('set-v2-sub', async (_event, subKey: string) => {
  const success = updateV2Sub(subKey)
  if (success) await restartHiFiCable()
  return { success, state: readConfigState() }
})

ipcMain.handle('check-config-exists', () => {
  return fs.existsSync(CONFIG_FILE)
})

// Audio device listing
interface AudioDevice {
  id: string
  name: string
  isDefault: boolean
}

function getAudioDevices(): Promise<AudioDevice[]> {
  return new Promise((resolve) => {
    // Get playback devices only (0.0.0 = render/playback, 0.0.1 = capture/recording)
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-PnpDevice -Class AudioEndpoint -Status OK | Where-Object { $_.FriendlyName -and $_.InstanceId -like '*{0.0.0*' } | Select-Object @{N='id';E={$_.InstanceId}}, @{N='name';E={$_.FriendlyName}} | ConvertTo-Json -Compress"`

    exec(cmd, (err, stdout) => {
      if (err) {
        console.error('Error getting audio devices:', err)
        resolve([])
        return
      }

      try {
        const trimmed = stdout.trim()
        if (!trimmed || trimmed === '' || trimmed === '[]') {
          resolve([])
          return
        }

        const parsed = JSON.parse(trimmed)
        const devices: AudioDevice[] = (Array.isArray(parsed) ? parsed : [parsed]).map((d: { id: string; name: string }, i: number) => ({
          id: d.id,
          name: d.name,
          isDefault: i === 0
        }))
        resolve(devices)
      } catch (parseErr) {
        console.error('Error parsing audio devices:', parseErr, stdout)
        resolve([])
      }
    })
  })
}

ipcMain.handle('get-audio-devices', () => getAudioDevices())

// Loudness Equalization control for the legacy 7.1 cable.
interface LoudnessSettings {
  enabled: boolean
  releaseTime: number
}

function getEndpointGuid(deviceId: string): string | null {
  return deviceId.match(/\{[0-9a-f-]{36}\}$/i)?.[0] ?? null
}

function getLoudnessSettings(deviceId: string): Promise<LoudnessSettings> {
  const endpointGuid = getEndpointGuid(deviceId)
  if (!endpointGuid) return Promise.resolve({ enabled: false, releaseTime: 40 })
  return new Promise((resolve) => {
    const fxPath = `HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render\\${endpointGuid}\\FxProperties`
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$fx = Get-ItemProperty -LiteralPath '${fxPath}' -ErrorAction SilentlyContinue; $enabled = $false; $rt = 4; if ($fx) { foreach ($suffix in @(3,1599)) { $key = '{fc52a749-4be9-4510-896e-966ba6525980},' + $suffix; $flag = $fx.PSObject.Properties[$key].Value; if ($flag -is [byte[]] -and $flag.Length -ge 10 -and $flag[8] -eq 255 -and $flag[9] -eq 255) { $enabled = $true }; $rtKey = '{9c00eeed-edce-4cd8-ae08-cb05e8ef57a0},' + $suffix; $rtValue = $fx.PSObject.Properties[$rtKey].Value; if ($rtValue -is [byte[]] -and $rtValue.Length -ge 9 -and $rtValue[8] -ge 2 -and $rtValue[8] -le 7) { $rt = [int]$rtValue[8] } } }; [PSCustomObject]@{enabled=$enabled;releaseTime=$rt} | ConvertTo-Json -Compress"`

    exec(cmd, (err, stdout) => {
      if (err) {
        console.error('Error getting loudness settings:', err)
        resolve({ enabled: false, releaseTime: 4 })
        return
      }
      try {
        const trimmed = stdout.trim()
        const parsed = JSON.parse(trimmed)
        // Convert release time 2-7 to 0-100 scale for slider
        const rtNormalized = Math.round(((parsed.releaseTime - 2) / 5) * 100)
        resolve({ enabled: parsed.enabled, releaseTime: rtNormalized })
      } catch (e) {
        console.error('Error parsing loudness settings:', e, stdout)
        resolve({ enabled: false, releaseTime: 50 })
      }
    })
  })
}

function setLoudnessEnabled(deviceId: string, enabled: boolean): Promise<boolean> {
  const endpointGuid = getEndpointGuid(deviceId)
  if (!endpointGuid) return Promise.resolve(false)
  const enabledBytes = enabled ? '0xff,0xff' : '0x00,0x00'
  const script = `$ErrorActionPreference = 'Stop'\n$fxPath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render\\${endpointGuid}\\FxProperties'\n$bytes = [byte[]]@(0x0b,0x00,0x00,0x00,0x01,0x00,0x00,0x00,${enabledBytes},0x00,0x00)\nforeach ($suffix in @(3,1599)) { New-ItemProperty -LiteralPath $fxPath -Name ('{fc52a749-4be9-4510-896e-966ba6525980},' + $suffix) -PropertyType Binary -Value $bytes -Force | Out-Null }\nRestart-Service audiosrv -Force\n`
  return runElevatedAudioTask('AstralSetLoudness.ps1', script)
}

function setLoudnessReleaseTime(deviceId: string, value: number): Promise<boolean> {
  const endpointGuid = getEndpointGuid(deviceId)
  if (!endpointGuid) return Promise.resolve(false)
  const releaseTime = Math.round((value / 100) * 5) + 2
  const script = `$ErrorActionPreference = 'Stop'\n$fxPath = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render\\${endpointGuid}\\FxProperties'\n$bytes = [byte[]]@(0x03,0x00,0x00,0x00,0x01,0x00,0x00,0x00,${releaseTime},0x00,0x00,0x00)\nforeach ($suffix in @(3,1599)) { New-ItemProperty -LiteralPath $fxPath -Name ('{9c00eeed-edce-4cd8-ae08-cb05e8ef57a0},' + $suffix) -PropertyType Binary -Value $bytes -Force | Out-Null }\nRestart-Service audiosrv -Force\n`
  return runElevatedAudioTask('AstralSetLoudnessRelease.ps1', script)
}

ipcMain.handle('get-loudness-settings', (_event, deviceId: string) => getLoudnessSettings(deviceId))
ipcMain.handle('set-loudness-enabled', (_event, deviceId: string, enabled: boolean) => setLoudnessEnabled(deviceId, enabled))
ipcMain.handle('set-loudness-release-time', (_event, deviceId: string, value: number) => setLoudnessReleaseTime(deviceId, value))

function runElevatedAudioTask(filename: string, script: string): Promise<boolean> {
  const scriptPath = path.join(app.getPath('temp'), filename)
  fs.writeFileSync(scriptPath, script, 'utf8')
  const escapedPath = scriptPath.replaceAll("'", "''")
  const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$process = Start-Process -FilePath 'powershell.exe' -Verb RunAs -WindowStyle Hidden -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','${escapedPath}') -Wait -PassThru; exit $process.ExitCode"`
  return new Promise(resolve => exec(command, error => resolve(!error)))
}

ipcMain.handle('restart-audio-device', async (_event, deviceId: string) => {
  if (!deviceId || deviceId.length > 1000) return false
  const escapedId = deviceId.replaceAll("'", "''")
  return runElevatedAudioTask('AstralRestartAudioDevice.ps1', `$ErrorActionPreference = 'Stop'\n$device = Get-PnpDevice -InstanceId '${escapedId}' -ErrorAction Stop\nDisable-PnpDevice -InstanceId $device.InstanceId -Confirm:$false -ErrorAction Stop\nStart-Sleep -Milliseconds 500\nEnable-PnpDevice -InstanceId $device.InstanceId -Confirm:$false -ErrorAction Stop\n`)
})

ipcMain.handle('restart-windows-audio', () => runElevatedAudioTask('AstralRestartAudioService.ps1', `$ErrorActionPreference = 'Stop'\nRestart-Service AudioEndpointBuilder -Force -ErrorAction Stop\nRestart-Service audiosrv -Force -ErrorAction Stop\n`))

ipcMain.handle('disable-voicemeeter-endpoints', () => runElevatedAudioTask('AstralDisableVoicemeeter.ps1', `
$ErrorActionPreference = 'Stop'
$nameKey = '{a45c254e-df1c-4efd-8020-67d146a850e0},2'
$roots = @(
  @{ Ps = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render'; Native = 'HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render'; Kind = 'Render' },
  @{ Ps = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Capture'; Native = 'HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Capture'; Kind = 'Capture' }
)
$changed = 0
foreach ($root in $roots) {
  Get-ChildItem -Path $root.Ps -ErrorAction SilentlyContinue | ForEach-Object {
    $props = Get-ItemProperty -LiteralPath (Join-Path $_.PSPath 'Properties') -ErrorAction SilentlyContinue
    $name = if ($props) { [string]$props.$nameKey } else { '' }
    $matches = if ($root.Kind -eq 'Render') {
      $name -eq 'Voicemeeter AUX Input' -or $name -eq 'Voicemeeter VAIO3 Input' -or $name -match '^Voicemeeter In [1-5]$'
    } else {
      $name -match '^Voicemeeter Out (A[1-5]|B[1-3])$'
    }
    if ($matches) {
      & reg.exe ADD "$($root.Native)\$($_.PSChildName)" /v DeviceState /t REG_DWORD /d 4 /f | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "Could not disable $name" }
      $changed++
    }
  }
}
Restart-Service AudioEndpointBuilder -Force -ErrorAction Stop
Restart-Service audiosrv -Force -ErrorAction Stop
Write-Output "Disabled $changed Voicemeeter endpoints."
`))

ipcMain.handle('open-eapo-device-selector', async () => {
  const selectorPath = 'C:\\Program Files\\EqualizerAPO\\DeviceSelector.exe'
  if (!fs.existsSync(selectorPath)) return false
  return (await shell.openPath(selectorPath)) === ''
})

// ============ CHANNEL CONFIGURATION (using NirSoft svcl.exe) ============

function getSvclPath(): string {
  const isDev = !app.isPackaged
  if (isDev) {
    return path.join(__dirname, '..', 'electron', 'tools', 'svcl.exe')
  } else {
    return path.join(process.resourcesPath, 'tools', 'svcl.exe')
  }
}

type CableEndpoint = 'legacy' | 'v5'

function runSvcl(args: string[]): Promise<{ success: boolean; stdout: string }> {
  return new Promise(resolve => {
    execFile(getSvclPath(), args, { windowsHide: true, timeout: 8000 }, (error, stdout) => {
      resolve({ success: !error, stdout: String(stdout) })
    })
  })
}

async function getEndpointState(deviceName: string): Promise<'active' | 'disabled' | 'unknown'> {
  const result = await runSvcl(['/Stdout', '/GetColumnValue', deviceName, 'DeviceState'])
  if (!result.success) return 'unknown'
  const outputLines = result.stdout.trim().split(/\r?\n/)
  const state = outputLines[outputLines.length - 1]?.trim().toLowerCase()
  return state === 'active' || state === 'disabled' ? state : 'unknown'
}

async function setEndpointEnabled(deviceName: string, enabled: boolean): Promise<boolean> {
  const result = await runSvcl([enabled ? '/Enable' : '/Disable', deviceName])
  if (!result.success) return false
  await new Promise(resolve => setTimeout(resolve, 250))
  return await getEndpointState(deviceName) === (enabled ? 'active' : 'disabled')
}

// Keep exactly one Astral cable endpoint active. Enabling the destination first
// prevents a failed switch from leaving Windows without an available output.
async function switchCableEndpoint(target: CableEndpoint): Promise<boolean> {
  const targetName = target === 'v5' ? V5_DEVICE_NAME : LEGACY_DEVICE_NAME
  const previousName = target === 'v5' ? LEGACY_DEVICE_NAME : V5_DEVICE_NAME
  const targetWasActive = await getEndpointState(targetName) === 'active'

  if (!await setEndpointEnabled(targetName, true)) return false
  if (await setEndpointEnabled(previousName, false)) return true

  // The old endpoint is still available, so restore the original route.
  await setEndpointEnabled(targetName, false)
  return false
}

// Get current channel config by exporting device info from svcl.exe
async function getChannelConfig(): Promise<'stereo' | '7.1' | null> {
  const svclPath = getSvclPath()
  const deviceName = LEGACY_DEVICE_NAME

  return new Promise((resolve) => {
    // Export to CSV format and parse
    const cmd = `"${svclPath}" /scomma "" /Columns "Name,Speakers Config"`

    exec(cmd, { encoding: 'utf8' }, (err, stdout, stderr) => {
      if (err) {
        console.error('Error getting channel config:', err)
        resolve(null)
        return
      }

      // Parse the CSV output to find Hi-Fi Cable Input
      const lines = stdout.split('\n')
      for (const line of lines) {
        if (line.includes(deviceName)) {
          // Check Speakers Config column for channel mask
          // 0x63f = 7.1 Surround, 0x3 = Stereo
          // Also check for "8 Channel" in the format info
          if (line.includes('0x63f') || line.includes('8 Channel')) {
            resolve('7.1')
            return
          } else if (line.includes('0x3') || line.includes('2 Channel')) {
            resolve('stereo')
            return
          }
        }
      }

      // Default to stereo if we can't determine
      console.log('Could not determine channel config, output:', stdout)
      resolve('stereo')
    })
  })
}

// Speaker config values from SoundVolumeView documentation:
// Stereo = 0x3, 7.1 Surround = 0x63f
async function setChannelConfig(channelConfig: 'stereo' | '7.1'): Promise<boolean> {
  const svclPath = getSvclPath()
  const deviceName = LEGACY_DEVICE_NAME

  // Channel mask values: Stereo = 0x3, 7.1 = 0x63f (1599 decimal)
  const channelMask = channelConfig === 'stereo' ? '0x3' : '0x63f'

  return new Promise((resolve) => {
    // svcl.exe /SetSpeakersConfig [Device Name] [Channel Mask] [Optional Speakers] [Full Range Speakers]
    const cmd = `"${svclPath}" /SetSpeakersConfig "${deviceName}" ${channelMask} ${channelMask} ${channelMask}`

    exec(cmd, (err, stdout, stderr) => {
      console.log('setChannelConfig output:', stdout, stderr)
      if (err) {
        console.error('Error setting channel config:', err)
        resolve(false)
        return
      }
      // svcl.exe doesn't output anything on success, so check for no error
      resolve(true)
    })
  })
}

ipcMain.handle('get-channel-config', () => getChannelConfig())
ipcMain.handle('set-channel-config', (_event, channelConfig: 'stereo' | '7.1') => setChannelConfig(channelConfig))

// ============ FILTER SELECTOR (EQ Files) ============

const EQ_BASE_FOLDER = path.join(CONFIG_PATH, 'data', 'eq')
const EQ_V2_FOLDER = path.join(EQ_BASE_FOLDER, 'v2')
const EQ_V3_FOLDER = path.join(EQ_BASE_FOLDER, 'v3')
const EQ_V5_FOLDER = path.join(EQ_BASE_FOLDER, 'v5')
const AT_V1_FILE = path.join(CONFIG_PATH, 'at_v1.txt')

// VST Plugin lines for V1 (reaxcomp + reaeq)
const VST_LINES_V1 = `
VSTPlugin: Library "C:\\Program Files\\VSTPlugins\\ReaPlugs\\reaxcomp-standalone.dll" ChunkData "OAAAAAYAAAAAAAAAAMBXQDQel0Pd/u8/kcKZfw7MPj8AAAAAAAA0QAAAAAAAAAAAAwAAABkAAAAFAAAAEAAAAAAAAAAAUHRAAAAAAAAA8D9McN2HeRPQPwAAAAAAAABAAAAAAAAAAAABAAAAUAAAANwAAAAQAAAAAAAAAACwjUAAAAAAAADwPwAAAAAAAPA/AAAAAAAAAEAAAAAAAAAAAA8AAACWAAAABQAAABgAAAAAAAAAAECfQAAAAAAAAPA/P5924xDDxj8AAAAAAAA0QAAAAAAAAAAAAQAAADIAAAAFAAAAEAAAAAAAAAAAQK9A2fPXW9iB9D+6PCfe3VrCPwAAAAAAAABAAAAAAAAAAAAPAAAAlgAAAAUAAAAYAAAAAAAAAABw10AAAAAAAADwP4ILRQZbCe4/AAAAAAAAAEAAAAAAAAAAAA8AAACWAAAABQAAABkAAAABAAAAAQAAAAAAAAAAAPA/AAAAAA=="
VSTPlugin: Library "C:\\Program Files\\VSTPlugins\\ReaPlugs\\reaeq-standalone.dll" ChunkData "IQAAAAQAAAAAAAAAAQAAAAAAAAAAwFdAwdzScC7F0j97FK5H4XqEPwAIAAAAAAAAAAAAAAAAwHJAAAAAAAAA8D8AAAAAAAAAQAEIAAAAAAAAAAAAAAAAQI9AAAAAAAAA8D8AAAAAAAAAQAEBAAAAAAAAAAAAAAAAiLNAAAAAAAAA8D8AAAAAAAAAQAEBAAAAAQAAAAAAAAAAAPA/AAAAAA=="
`.trim()

// VST Plugin lines for AIWV2 (reajs + reacomp)
const VST_LINES_V2 = `
VSTPlugin: Library "C:\\Program Files\\VSTPlugins\\ReaPlugs\\reajs.dll" ChunkData "QXJ0VHVuZUtpdC9hdGtfc3RlcmVvX3NwYXRpYWxfZW5oYW5jZXIuanNmeAAxMC4zMzMzMzMgOTUuMDAwMDAwIDAuMDAwMDAwIDE1MDAuMDAwMDAwIDEuMDAwMDAwIDAuMDAwMDAwIDEuMDAwMDAwIC0gLSAtIC0gLSAtIC0gLSAtIC0gLSAtIC0gLSAtIC0gLSAtIC0gLSAtIC0gLSAtIC0gLSAtIC0gLSAtIC0gLSAtIC0gLSAtIC0gLSAtIC0gLSAtIC0gLSAtIC0gLSAtIC0gLSAtIC0gLSAtIC0gLSAtIAAAAAAA"
VSTPlugin: Library "C:\\Program Files\\VSTPlugins\\ReaPlugs\\reacomp-standalone.dll" Thresh 0.98854345 Ratio 0.1919192 Attack 0.0006 Release 0.01 Pre-comp 0 resvd 0 Lowpass 1 Hipass 0 SignIn 0 AudIn 0 Dry 3.1622776E-08 Wet 1 PreviewF 0 "RMS size" 0 Knee 0 AutoMkUp 0 AutoRel 0 ClsAttk 0 AntiAls 0.07692308
`.trim()

// Helper to get EQ folder based on config version
function getEQFolder(configVersion: 'v1' | 'aiwv2' | 'aiwv5'): string {
  return configVersion === 'aiwv5' ? EQ_V5_FOLDER : configVersion === 'aiwv2' ? EQ_V3_FOLDER : EQ_V2_FOLDER
}

// Helper to get VST lines based on config version
function getVSTLines(configVersion: 'v1' | 'aiwv2'): string {
  return configVersion === 'aiwv2' ? VST_LINES_V2 : VST_LINES_V1
}

interface FilterInfo {
  name: string
  filename: string
  fullPath: string
}

interface PreampSettings {
  enabled: boolean
  value: number
}

// Get list of all EQ filter files for a specific config version
function getFilterFiles(configVersion: 'v1' | 'aiwv2' = 'v1'): FilterInfo[] {
  try {
    const eqFolder = getEQFolder(configVersion)
    if (!fs.existsSync(eqFolder)) {
      console.log('EQ folder does not exist:', eqFolder)
      return []
    }
    const files = fs.readdirSync(eqFolder)
    return files
      .filter(f => f.endsWith('.txt'))
      .map(f => ({
        name: f.replace('.txt', ''),
        filename: f,
        fullPath: path.join(eqFolder, f)
      }))
  } catch (err) {
    console.error('Error reading EQ folder:', err)
    return []
  }
}

function getAutoEqLibrary() {
  const groups = [
    { id: 'atV1', label: 'AT V1', folder: 'v2', directory: EQ_V2_FOLDER },
    { id: 'aiwV3', label: 'AIW V3', folder: 'v3', directory: EQ_V3_FOLDER },
    { id: 'aiwV5', label: 'AIW V5', folder: 'v5', directory: EQ_V5_FOLDER },
  ] as const

  return groups.map(group => ({
    id: group.id,
    label: group.label,
    folder: group.folder,
    activeFilename: group.id === 'atV1'
      ? (getCurrentFilter('v1') ? `${getCurrentFilter('v1')}.txt` : null)
      : group.id === 'aiwV3'
        ? (getCurrentFilter('aiwv2') ? `${getCurrentFilter('aiwv2')}.txt` : null)
        : (readV5Include('headphone') ? path.basename(readV5Include('headphone')!) : null),
    files: fs.existsSync(group.directory)
      ? fs.readdirSync(group.directory)
        .filter(filename => filename.toLocaleLowerCase().endsWith('.txt'))
        .map(filename => {
          const content = fs.readFileSync(path.join(group.directory, filename), 'utf8')
          const target = content.match(/^# Target:\s*(.+)$/mi)?.[1]?.trim() ?? null
          const name = filename.replace(/\.txt$/i, '')
          const headphoneName = content.match(/^# Headphone:\s*(.+)$/mi)?.[1]?.trim() ?? name
          const sourceFile = content.match(/^# Source file:\s*(.+)$/mi)?.[1]?.trim() ?? null
          const sourceParts = sourceFile?.split(/[\\/]/).filter(Boolean) ?? []
          const source = sourceParts.length > 2 ? sourceParts[1] : null
          return { name, headphoneName, source, filename, target }
        })
        .sort((left, right) => left.name.localeCompare(right.name))
      : [],
  }))
}

// Get the currently selected filter from at_v1.txt or aiw_v3.txt
function getCurrentFilter(configVersion: 'v1' | 'aiwv2' = 'v1'): string | null {
  try {
    const configFile = configVersion === 'aiwv2' ? AIW_V3_FILE : AT_V1_FILE
    const eqPathPattern = configVersion === 'aiwv2'
      ? /Include:\s*data\\eq\\v3\\(.+\.txt)/i
      : /Include:\s*data\\eq\\v2\\(.+\.txt)/i

    if (!fs.existsSync(configFile)) {
      return null
    }
    const content = fs.readFileSync(configFile, 'utf-8')
    const lines = content.split('\n')
    for (const line of lines) {
      const match = line.match(eqPathPattern)
      if (match) {
        return match[1].replace('.txt', '')
      }
    }
    return null
  } catch (err) {
    console.error(`Error reading ${configVersion === 'aiwv2' ? 'aiw_v3.txt' : 'at_v1.txt'}:`, err)
    return null
  }
}

// Ensure VST lines are present at the end of an EQ file
function ensureVSTLines(filterName: string, configVersion: 'v1' | 'aiwv2' = 'v1'): boolean {
  try {
    const eqFolder = getEQFolder(configVersion)
    const filePath = path.join(eqFolder, `${filterName}.txt`)
    if (!fs.existsSync(filePath)) {
      return false
    }

    let content = fs.readFileSync(filePath, 'utf-8')
    const vstLines = getVSTLines(configVersion)

    // Check if correct VST lines already exist based on version
    if (configVersion === 'aiwv2') {
      if (content.includes('reajs.dll') && content.includes('reacomp-standalone.dll')) {
        return true // Already has V2 VST lines
      }
    } else {
      if (content.includes('reaxcomp-standalone.dll') && content.includes('reaeq-standalone.dll')) {
        return true // Already has V1 VST lines
      }
    }

    // Remove any existing VST lines and add correct ones
    const lines = content.split('\n')
    const newLines = lines.filter(line => !line.trim().startsWith('VSTPlugin:'))

    // Remove trailing empty lines
    while (newLines.length > 0 && !newLines[newLines.length - 1].trim()) {
      newLines.pop()
    }

    // Add VST lines at the end
    newLines.push(vstLines)

    fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8')
    return true
  } catch (err) {
    console.error('Error ensuring VST lines:', err)
    return false
  }
}

// Set the selected filter in at_v1.txt (for V1) or aiw_v3.txt (for AIWV2)
function setCurrentFilter(filterName: string, configVersion: 'v1' | 'aiwv2' = 'v1'): boolean {
  try {
    if (configVersion === 'aiwv2') {
      const content = `Include: data\\AIWV2\\aw_pc.txt
Include: data\\AIWV2\\at.txt
Include: data\\eq\\v3\\${filterName}.txt
`
      fs.writeFileSync(AIW_V3_FILE, content, 'utf-8')
    } else {
      const content = `Include: data\\ATAIW\\pc.txt
Include: data\\ATAIW\\at.txt
Include: data\\eq\\v2\\${filterName}.txt
`
      fs.writeFileSync(AT_V1_FILE, content, 'utf-8')
    }

    // Ensure VST lines are present in the selected filter file
    ensureVSTLines(filterName, configVersion)

    return true
  } catch (err) {
    console.error(`Error writing ${configVersion === 'aiwv2' ? 'aiw_v3.txt' : 'at_v1.txt'}:`, err)
    return false
  }
}

// Parse preamp from EQ file content
function parsePreamp(content: string): PreampSettings {
  const lines = content.split('\n')
  for (const line of lines) {
    const match = line.match(/^(#?)\s*Preamp:\s*([-\d.]+)\s*dB/i)
    if (match) {
      return {
        enabled: match[1] !== '#',
        value: parseFloat(match[2])
      }
    }
  }
  return { enabled: false, value: 0 }
}

// Get preamp settings for a filter
function getPreampSettings(filterName: string, configVersion: 'v1' | 'aiwv2' | 'aiwv5' = 'v1'): PreampSettings {
  try {
    const eqFolder = getEQFolder(configVersion)
    const filePath = path.join(eqFolder, `${filterName}.txt`)
    if (!fs.existsSync(filePath)) {
      return { enabled: false, value: 0 }
    }
    const content = fs.readFileSync(filePath, 'utf-8')
    return parsePreamp(content)
  } catch (err) {
    console.error('Error reading preamp:', err)
    return { enabled: false, value: 0 }
  }
}

// Set preamp settings for a filter. Legacy profiles keep their required VST
// lines; the native V5 EQ file is changed without injecting legacy plugins.
function setPreampSettings(filterName: string, enabled: boolean, value: number, configVersion: 'v1' | 'aiwv2' | 'aiwv5' = 'v1'): boolean {
  try {
    const eqFolder = getEQFolder(configVersion)
    const filePath = path.join(eqFolder, `${filterName}.txt`)
    if (!fs.existsSync(filePath)) {
      return false
    }

    let content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    let newLines: string[] = []
    let foundPreamp = false
    const isV5 = configVersion === 'aiwv5'
    const vstLines = isV5 ? null : getVSTLines(configVersion)

    // Process lines, update preamp, remove existing VST lines
    for (const line of lines) {
      const trimmed = line.trim()
      // Skip existing VST lines (we'll add them at the end)
      if (!isV5 && trimmed.startsWith('VSTPlugin:')) {
        continue
      }
      // Update preamp line
      if (trimmed.match(/^#?\s*Preamp:/i)) {
        const prefix = enabled ? '' : '# '
        newLines.push(`${prefix}Preamp: ${value} dB`)
        foundPreamp = true
      } else if (trimmed) {
        newLines.push(line)
      }
    }

    // Add preamp if not found
    if (!foundPreamp) {
      const prefix = enabled ? '' : '# '
      newLines.unshift(`${prefix}Preamp: ${value} dB`)
    }

    // Add VST lines at the end
    if (vstLines) newLines.push(vstLines)

    fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8')
    return true
  } catch (err) {
    console.error('Error setting preamp:', err)
    return false
  }
}

// IPC handlers with config version support
ipcMain.handle('get-filter-files', (_event, configVersion: 'v1' | 'aiwv2' = 'v1') => getFilterFiles(configVersion))
ipcMain.handle('get-auto-eq-library', () => getAutoEqLibrary())
ipcMain.handle('get-current-filter', (_event, configVersion: 'v1' | 'aiwv2' = 'v1') => getCurrentFilter(configVersion))
ipcMain.handle('set-current-filter', (_event, filterName: string, configVersion: 'v1' | 'aiwv2' = 'v1') => setCurrentFilter(filterName, configVersion))
ipcMain.handle('get-preamp-settings', (_event, filterName: string, configVersion: 'v1' | 'aiwv2' | 'aiwv5' = 'v1') => getPreampSettings(filterName, configVersion))
ipcMain.handle('set-preamp-settings', (_event, filterName: string, enabled: boolean, value: number, configVersion: 'v1' | 'aiwv2' | 'aiwv5' = 'v1') => setPreampSettings(filterName, enabled, value, configVersion))

// AIW V5 is a separate 16-channel chain. These read-only discovery handlers
// intentionally do not assume the final library location; the path resolver
// supports the current reference layout and the two planned layouts.
ipcMain.handle('get-v5-readiness', () => getV5Readiness())
ipcMain.handle('get-v5-presets', () => listV5Presets())
ipcMain.handle('get-headphone-eqs', () => listHeadphoneEqs())
ipcMain.handle('search-headphone-eqs', (_event, query: string, limit?: number, type?: string) => searchHeadphoneEqs(query, limit, type))

function readV5Include(slot: V5IncludeSlot): string | null {
  if (!fs.existsSync(MAIN_CONFIG_FILE)) return null
  const lines = fs.readFileSync(MAIN_CONFIG_FILE, 'utf8').split(/\r?\n/)
  const index=v5SlotIndex(lines,slot)
  return index<0?null:lines[index].replace(/^\s*#?\s*Include:\s*/i,'').trim()

}

ipcMain.handle('get-v5-active-state', () => {
  const tuneInclude = readV5Include('tune')
  const headphoneInclude = readV5Include('headphone')
  let headphoneName: string | null = null
  let headphoneSource: string | null = null
  let headphoneChannel: string | null = null
  let headphoneTarget: string | null = null
  let headphoneFitError: string | null = null
  if (headphoneInclude) {
    const absolute = path.resolve(path.dirname(MAIN_CONFIG_FILE), headphoneInclude)
    if (fs.existsSync(absolute)) {
      const lines = fs.readFileSync(absolute, 'utf8').split(/\r?\n/)
      const headphoneLine = lines.find(line => line.startsWith('# Headphone:'))
      const measurementSourceLine = lines.find(line => line.startsWith('# Measurement source:'))
      const legacySourceLine = lines.find(line => line.startsWith('# Source:'))
      const channelLine = lines.find(line => line.startsWith('# Channel:'))
      const targetLine = lines.find(line => line.startsWith('# Target:'))
      const fitLine = lines.find(line => line.startsWith('# Fit error'))
      headphoneName = headphoneLine?.replace('# Headphone:', '').trim()
        ?? legacySourceLine?.replace('# Source:', '').trim().replace(/\.txt$/i, '')
        ?? path.basename(absolute, '.txt')
      headphoneSource = measurementSourceLine?.replace('# Measurement source:', '').trim() ?? null
      headphoneChannel = channelLine?.replace('# Channel:', '').trim() ?? null
      headphoneTarget = targetLine?.replace('# Target:', '').trim() ?? null
      headphoneFitError = fitLine?.replace(/^# Fit error[^:]*:\s*/i, '').trim() ?? null
      if (!headphoneSource) {
        const match = searchHeadphoneEqs(headphoneName, 1).results[0]
        headphoneSource = match?.source ?? null
      }
    }
  }
  return {
    tuneFilename: tuneInclude ? path.basename(tuneInclude) : null,
    headphoneEqFilename: headphoneInclude ? path.basename(headphoneInclude) : null,
    headphoneName,
    headphoneSource,
    headphoneChannel,
    headphoneTarget,
    headphoneFitError,
  }
})

type V5IncludeSlot = 'tune' | 'headphone'

function updateV5Include(slot: V5IncludeSlot, absoluteFile: string): boolean {
  if (!fs.existsSync(MAIN_CONFIG_FILE)) return false
  const relativeFile = path.relative(path.dirname(MAIN_CONFIG_FILE), absoluteFile).replaceAll('/', '\\')
  if (relativeFile.startsWith('..')) return false

  const lines = fs.readFileSync(MAIN_CONFIG_FILE, 'utf8').split(/\r?\n/)
  const includeIndex=v5SlotIndex(lines,slot)
  if(includeIndex<0)return false
  const enabled=readConfigState().mainConfig==='aiwv5'
  lines[includeIndex]=(enabled?'':'# ')+`Include: ${relativeFile}`
  const temporaryFile = `${MAIN_CONFIG_FILE}.astral.tmp`
  fs.writeFileSync(temporaryFile, lines.join('\r\n'), 'utf8')
  fs.renameSync(temporaryFile, MAIN_CONFIG_FILE)
  return true
}

function restartV5Cable(): Promise<boolean> {
  return queueAudioDeviceMutation(() => new Promise(resolve => {
    const escapedName = V5_DEVICE_NAME.replaceAll("'", "''")
    const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$device = Get-PnpDevice -Class AudioEndpoint | Where-Object { $_.FriendlyName -like '*${escapedName}*' } | Select-Object -First 1; if ($device) { Disable-PnpDevice -InstanceId $device.InstanceId -Confirm:$false; Start-Sleep -Milliseconds 350; Enable-PnpDevice -InstanceId $device.InstanceId -Confirm:$false; 'OK' } else { 'NOT_FOUND' }"`
    exec(command, { timeout: 12000, windowsHide: true }, (error, stdout) => resolve(!error && stdout.includes('OK')))
  }))
}

ipcMain.handle('set-v5-preset', async (_event, filename: string) => {
  const preset = resolveV5Preset(filename)
  if (!preset) return { success: false, code: 'V5_PRESET_NOT_FOUND' }
  const success = updateV5Include('tune', preset)
  if (!success) return { success: false, code: 'V5_CONFIG_NOT_READY' }
  const restarted = await restartV5Cable()
  return { success: true, restarted }
})

ipcMain.handle('set-v5-headphone-eq', async (event, relativePath: string) => {
  const headphoneEq = resolveHeadphoneEq(relativePath)
  if (!headphoneEq) return { success: false, code: 'HEADPHONE_EQ_NOT_FOUND' }
  const generatedEqs = await generateHeadphoneEqSet(headphoneEq, progress => {
    if (!event.sender.isDestroyed()) event.sender.send('auto-eq-progress', progress)
  })
  if (!generatedEqs) return { success: false, code: 'AUTO_EQ_GENERATION_FAILED' }
  const atV1Name = path.basename(generatedEqs.atV1.outputFile, '.txt')
  const aiwV3Name = path.basename(generatedEqs.aiwV3.outputFile, '.txt')
  const success = setCurrentFilter(atV1Name, 'v1')
    && setCurrentFilter(aiwV3Name, 'aiwv2')
    && updateV5Include('headphone', generatedEqs.aiwV5.outputFile)
  if (!success) return { success: false, code: 'EQ_CONFIG_NOT_READY' }
  const restarts = await Promise.all([restartHiFiCable(), restartV5Cable()])
  const restarted = restarts.every(Boolean)
  return { success: true, restarted, autoEq: generatedEqs.aiwV5, generatedEqs }
})

ipcMain.handle('apply-saved-headphone-eq', async (_event, profile: 'atV1' | 'aiwV3' | 'aiwV5', filename: string) => {
  if (path.basename(filename) !== filename || !filename.toLocaleLowerCase().endsWith('.txt')) return { success: false, code: 'INVALID_EQ_FILE' }
  const folder = profile === 'atV1' ? EQ_V2_FOLDER : profile === 'aiwV3' ? EQ_V3_FOLDER : EQ_V5_FOLDER
  const absoluteFile = path.join(folder, filename)
  if (!fs.existsSync(absoluteFile)) return { success: false, code: 'EQ_NOT_FOUND' }
  const filterName = path.basename(filename, '.txt')
  const success = profile === 'atV1'
    ? setCurrentFilter(filterName, 'v1')
    : profile === 'aiwV3'
      ? setCurrentFilter(filterName, 'aiwv2')
      : updateV5Include('headphone', absoluteFile)
  if (!success) return { success: false, code: 'EQ_CONFIG_NOT_READY' }
  const restarted = profile === 'aiwV5' ? await restartV5Cable() : await restartHiFiCable()
  return { success: true, restarted }
})

ipcMain.handle('delete-saved-headphone-eq', (_event, files: Partial<Record<'atV1' | 'aiwV3' | 'aiwV5', string>>) => {
  const folders = { atV1: EQ_V2_FOLDER, aiwV3: EQ_V3_FOLDER, aiwV5: EQ_V5_FOLDER } as const
  const validProfiles = new Set(Object.keys(folders))
  const rawEntries = Object.entries(files ?? {})
  if (!rawEntries.length || rawEntries.some(([profile, filename]) => !validProfiles.has(profile) || typeof filename !== 'string')) {
    return { success: false, code: 'INVALID_EQ_FILES' }
  }
  const entries = rawEntries as Array<['atV1' | 'aiwV3' | 'aiwV5', string]>

  const filenames = new Set(entries.map(([, filename]) => filename.toLocaleLowerCase()))
  if (filenames.size !== 1) return { success: false, code: 'INVALID_EQ_FILES' }
  if ([...filenames].some(filename => filename === 'flat.txt')) return { success: false, code: 'PROTECTED_EQ' }

  const activeFiles = {
    atV1: getCurrentFilter('v1') ? `${getCurrentFilter('v1')}.txt` : null,
    aiwV3: getCurrentFilter('aiwv2') ? `${getCurrentFilter('aiwv2')}.txt` : null,
    aiwV5: readV5Include('headphone') ? path.basename(readV5Include('headphone')!) : null,
  }
  const targets: string[] = []
  for (const [profile, filename] of entries) {
    if (path.basename(filename) !== filename || !filename.toLocaleLowerCase().endsWith('.txt')) return { success: false, code: 'INVALID_EQ_FILES' }
    if (activeFiles[profile]?.toLocaleLowerCase() === filename.toLocaleLowerCase()) return { success: false, code: 'EQ_IN_USE' }
    const target = path.join(folders[profile], filename)
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return { success: false, code: 'EQ_NOT_FOUND' }
    targets.push(target)
  }

  const staged = targets.map((target, index) => `${target}.astral-delete-${process.pid}-${Date.now()}-${index}`)
  try {
    targets.forEach((target, index) => fs.renameSync(target, staged[index]))
    staged.forEach(target => fs.rmSync(target, { force: true }))
    return { success: true, deleted: targets.length }
  } catch (error) {
    staged.forEach((temporary, index) => {
      try { if (fs.existsSync(temporary) && !fs.existsSync(targets[index])) fs.renameSync(temporary, targets[index]) } catch { /* best-effort rollback */ }
    })
    console.error('Unable to delete saved headphone EQ:', error)
    return { success: false, code: 'EQ_DELETE_FAILED' }
  }
})

// Plugin controls use a separate shared profile, not legacy APO routing files.
const pluginControl = new PluginControlStore(pluginControlDirectory())
const pluginTransfer=createPluginTransfer(pluginControl.library,()=>win)
ipcMain.handle('import-plugin-preset',()=>pluginTransfer.import())
ipcMain.handle('export-plugin-preset',(_event,id:unknown)=>pluginTransfer.export(id))
ipcMain.handle('list-plugin-presets', () => pluginControl.listSaved())
ipcMain.handle('save-plugin-preset', (_event, name: unknown, revision: unknown) => pluginControl.saveNamed(name, revision))
ipcMain.handle('load-plugin-preset', (_event, id: unknown) => pluginControl.loadSaved(id))
ipcMain.handle('builtin-plugin-preset', (_event, id: unknown) => pluginControl.builtin(id))
ipcMain.handle('get-plugin-control', () => pluginControl.get())
ipcMain.handle('patch-plugin-control', (_event, patch: unknown) => pluginControl.patch(patch))
ipcMain.handle('select-plugin-profile', (_event, profile: unknown) => pluginControl.select(profile))

ipcMain.handle('audio-access-status',()=>audioAccess.start())
ipcMain.handle('audio-access-login',()=>audioAccess.login())
ipcMain.handle('audio-access-retry',()=>audioAccess.retry())
ipcMain.handle('audio-access-logout',()=>audioAccess.logout())

let diagnosticsRun: ReturnType<typeof runDiagnostics> | undefined
ipcMain.handle('run-audio-diagnostics',()=>diagnosticsRun??=(runDiagnostics().finally(()=>{diagnosticsRun=undefined})))
