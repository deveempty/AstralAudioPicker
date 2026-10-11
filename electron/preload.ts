import { contextBridge, ipcRenderer } from 'electron'

// Note: Types are declared in src/types/electron.d.ts for renderer consumption
// Here we just expose the IPC bridge without explicit typing to avoid conflicts

const electronAPI = {
  importPluginPreset: () => ipcRenderer.invoke('import-plugin-preset'),
  exportPluginPreset: (id:string) => ipcRenderer.invoke('export-plugin-preset',id),
  runAudioDiagnostics: () => ipcRenderer.invoke('run-audio-diagnostics'),
  audioAccessStatus: () => ipcRenderer.invoke('audio-access-status'),
  audioAccessLogin: () => ipcRenderer.invoke('audio-access-login'),
  audioAccessRetry: () => ipcRenderer.invoke('audio-access-retry'),
  audioAccessLogout: () => ipcRenderer.invoke('audio-access-logout'),
  listPluginPresets: () => ipcRenderer.invoke('list-plugin-presets'),
  savePluginPreset: (name: string, revision: number) => ipcRenderer.invoke('save-plugin-preset', name, revision),
  loadPluginPreset: (id: string) => ipcRenderer.invoke('load-plugin-preset', id),
  applyBuiltinPluginPreset: (id: string) => ipcRenderer.invoke('builtin-plugin-preset', id),
  getPluginControl: () => ipcRenderer.invoke('get-plugin-control'),
  patchPluginControl: (patch: Record<string, number>) => ipcRenderer.invoke('patch-plugin-control', patch),
  selectPluginProfile: (profile: 'standard' | 'custom') => ipcRenderer.invoke('select-plugin-profile', profile),
  minimize: () => ipcRenderer.send('minimize'),
  close: () => ipcRenderer.send('close'),
  getConfigState: () => ipcRenderer.invoke('get-config-state'),
  setMainConfig: (selection: 'none' | 'v1' | 'v2' | 'aiwv2' | 'aiwv5' | 'custom') => ipcRenderer.invoke('set-main-config', selection),
  setV2Sub: (subKey: string) => ipcRenderer.invoke('set-v2-sub', subKey),
  checkConfigExists: () => ipcRenderer.invoke('check-config-exists'),
  getAudioDevices: () => ipcRenderer.invoke('get-audio-devices'),
  getLoudnessSettings: (deviceId: string) => ipcRenderer.invoke('get-loudness-settings', deviceId),
  setLoudnessEnabled: (deviceId: string, enabled: boolean) => ipcRenderer.invoke('set-loudness-enabled', deviceId, enabled),
  setLoudnessReleaseTime: (deviceId: string, value: number) => ipcRenderer.invoke('set-loudness-release-time', deviceId, value),
  restartAudioDevice: (deviceId: string) => ipcRenderer.invoke('restart-audio-device', deviceId),
  restartWindowsAudio: () => ipcRenderer.invoke('restart-windows-audio'),
  openEapoDeviceSelector: () => ipcRenderer.invoke('open-eapo-device-selector'),
  disableVoicemeeterEndpoints: () => ipcRenderer.invoke('disable-voicemeeter-endpoints'),
  getChannelConfig: () => ipcRenderer.invoke('get-channel-config'),
  setChannelConfig: (channelConfig: 'stereo' | '7.1') => ipcRenderer.invoke('set-channel-config', channelConfig),
  getFilterFiles: (configVersion: 'v1' | 'aiwv2' = 'v1') => ipcRenderer.invoke('get-filter-files', configVersion),
  getAutoEqLibrary: () => ipcRenderer.invoke('get-auto-eq-library'),
  applySavedHeadphoneEq: (profile: 'atV1' | 'aiwV3' | 'aiwV5', filename: string) => ipcRenderer.invoke('apply-saved-headphone-eq', profile, filename),
  deleteSavedHeadphoneEq: (files: Partial<Record<'atV1' | 'aiwV3' | 'aiwV5', string>>) => ipcRenderer.invoke('delete-saved-headphone-eq', files),
  getCurrentFilter: (configVersion: 'v1' | 'aiwv2' = 'v1') => ipcRenderer.invoke('get-current-filter', configVersion),
  setCurrentFilter: (filterName: string, configVersion: 'v1' | 'aiwv2' = 'v1') => ipcRenderer.invoke('set-current-filter', filterName, configVersion),
  getPreampSettings: (filterName: string, configVersion: 'v1' | 'aiwv2' | 'aiwv5' = 'v1') => ipcRenderer.invoke('get-preamp-settings', filterName, configVersion),
  setPreampSettings: (filterName: string, enabled: boolean, value: number, configVersion: 'v1' | 'aiwv2' | 'aiwv5' = 'v1') => ipcRenderer.invoke('set-preamp-settings', filterName, enabled, value, configVersion),
  getV5Readiness: () => ipcRenderer.invoke('get-v5-readiness'),
  getV5Presets: () => ipcRenderer.invoke('get-v5-presets'),
  getHeadphoneEqs: () => ipcRenderer.invoke('get-headphone-eqs'),
  searchHeadphoneEqs: (query: string, limit = 80, type = 'all') => ipcRenderer.invoke('search-headphone-eqs', query, limit, type),
  getV5ActiveState: () => ipcRenderer.invoke('get-v5-active-state'),
  setV5Preset: (filename: string) => ipcRenderer.invoke('set-v5-preset', filename),
  setV5HeadphoneEq: (relativePath: string) => ipcRenderer.invoke('set-v5-headphone-eq', relativePath),
  onAutoEqProgress: (callback: (progress: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: unknown) => callback(progress)
    ipcRenderer.on('auto-eq-progress', listener)
    return () => ipcRenderer.removeListener('auto-eq-progress', listener)
  },
  getPickerUpdateStatus: () => ipcRenderer.invoke('get-picker-update-status'),
  checkPickerUpdates: () => ipcRenderer.invoke('check-picker-updates'),
  installPickerUpdate: () => ipcRenderer.invoke('install-picker-update'),
  onPickerUpdateStatus: (callback: (status: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: unknown) => callback(status)
    ipcRenderer.on('picker-update-status', listener)
    return () => ipcRenderer.removeListener('picker-update-status', listener)
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
