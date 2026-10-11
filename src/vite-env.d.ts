/// <reference types="vite/client" />

import type {
  PluginLibraryResult,
  BuiltinPluginProfile,
  PluginParameterId,
  PluginProfile,
  PluginResult,
  AudioDevice,
  FilterInfo,
  LoudnessSettings,
  PreampSettings,
  ConfigState,
  ConfigResult,
  V5Preset,
  HeadphoneEq,
  V5Readiness,
  ApplyResult,
  HeadphoneSearchResult,
  V5ActiveState,
  AutoEqLibraryGroup,
  EqProfile,
  UpdateStatus,
  AutoEqGenerationProgress,
  SavedEqFiles,
  DeleteSavedEqResult,
} from './types/electron'

declare global {
  const __APP_VERSION__: string

  interface Window {
    electronAPI: {
      importPluginPreset: () => Promise<import('../shared/plugin-control').PluginTransferResult>
      exportPluginPreset: (id:string) => Promise<import('../shared/plugin-control').PluginTransferResult>
      runAudioDiagnostics: () => Promise<import('../shared/diagnostics').DiagnosticReport>
      audioAccessStatus: () => Promise<import('../shared/audio-access').AudioAccessStatus>
      audioAccessLogin: () => Promise<import('../shared/audio-access').AudioAccessStatus>
      audioAccessRetry: () => Promise<import('../shared/audio-access').AudioAccessStatus>
      audioAccessLogout: () => Promise<import('../shared/audio-access').AudioAccessStatus>
      listPluginPresets: () => Promise<PluginLibraryResult>
      savePluginPreset: (name: string, revision: number) => Promise<PluginLibraryResult>
      loadPluginPreset: (id: string) => Promise<PluginResult>
      applyBuiltinPluginPreset: (id: BuiltinPluginProfile) => Promise<PluginResult>
      getPluginControl: () => Promise<PluginResult>
      patchPluginControl: (patch: Partial<Record<PluginParameterId, number>>) => Promise<PluginResult>
      selectPluginProfile: (profile: PluginProfile) => Promise<PluginResult>
      minimize: () => void
      close: () => void
      getConfigState: () => Promise<ConfigState>
      setMainConfig: (selection: 'none' | 'v1' | 'v2' | 'aiwv2' | 'aiwv5' | 'custom') => Promise<ConfigResult>
      setV2Sub: (subKey: string) => Promise<ConfigResult>
      checkConfigExists: () => Promise<boolean>
      getAudioDevices: () => Promise<AudioDevice[]>
      getLoudnessSettings: (deviceId: string) => Promise<LoudnessSettings>
      setLoudnessEnabled: (deviceId: string, enabled: boolean) => Promise<boolean>
      setLoudnessReleaseTime: (deviceId: string, value: number) => Promise<boolean>
      restartAudioDevice: (deviceId: string) => Promise<boolean>
      restartWindowsAudio: () => Promise<boolean>
      openEapoDeviceSelector: () => Promise<boolean>
      disableVoicemeeterEndpoints: () => Promise<boolean>
      getChannelConfig: () => Promise<'stereo' | '7.1' | null>
      setChannelConfig: (channelConfig: 'stereo' | '7.1') => Promise<boolean>
      getFilterFiles: (configVersion?: 'v1' | 'aiwv2') => Promise<FilterInfo[]>
      getAutoEqLibrary: () => Promise<AutoEqLibraryGroup[]>
      applySavedHeadphoneEq: (profile: EqProfile, filename: string) => Promise<ApplyResult>
      deleteSavedHeadphoneEq: (files: SavedEqFiles) => Promise<DeleteSavedEqResult>
      getCurrentFilter: (configVersion?: 'v1' | 'aiwv2') => Promise<string | null>
      setCurrentFilter: (filterName: string, configVersion?: 'v1' | 'aiwv2') => Promise<boolean>
      getPreampSettings: (filterName: string, configVersion?: 'v1' | 'aiwv2' | 'aiwv5') => Promise<PreampSettings>
      setPreampSettings: (filterName: string, enabled: boolean, value: number, configVersion?: 'v1' | 'aiwv2' | 'aiwv5') => Promise<boolean>
      getV5Readiness: () => Promise<V5Readiness>
      getV5Presets: () => Promise<V5Preset[]>
      getHeadphoneEqs: () => Promise<HeadphoneEq[]>
      searchHeadphoneEqs: (query: string, limit?: number, type?: 'all' | 'IEM' | 'Headphone') => Promise<HeadphoneSearchResult>
      getV5ActiveState: () => Promise<V5ActiveState>
      setV5Preset: (filename: string) => Promise<ApplyResult>
      setV5HeadphoneEq: (relativePath: string) => Promise<ApplyResult>
      onAutoEqProgress: (callback: (progress: AutoEqGenerationProgress) => void) => () => void
      getPickerUpdateStatus: () => Promise<UpdateStatus>
      checkPickerUpdates: () => Promise<boolean>
      installPickerUpdate: () => Promise<boolean>
      onPickerUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void
    }
  }
}

export {}
