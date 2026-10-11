// Shared type definitions that match the preload.ts interfaces

export interface ConfigState {
  mainConfig: 'none' | 'v1' | 'v2' | 'aiwv2' | 'aiwv5' | 'custom'
  v2Subs: { [key: string]: boolean }
}

export interface ConfigResult {
  code?: string
  success: boolean
  state: ConfigState
}

export type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'migrating' | 'error' | 'development'
export interface UpdateStatus {
  phase: UpdatePhase
  version?: string
  progress?: number
  message?: string
}

export interface AudioDevice {
  id: string
  name: string
  isDefault: boolean
}

export interface LoudnessSettings {
  enabled: boolean
  releaseTime: number
}

export interface FilterInfo {
  name: string
  filename: string
  fullPath: string
}

export interface AutoEqLibraryGroup {
  id: 'atV1' | 'aiwV3' | 'aiwV5'
  label: 'AT V1' | 'AIW V3' | 'AIW V5'
  folder: 'v2' | 'v3' | 'v5'
  activeFilename: string | null
  files: Array<{ name: string; headphoneName: string; source: string | null; filename: string; target: string | null }>
}

export type EqProfile = 'atV1' | 'aiwV3' | 'aiwV5'

export type SavedEqFiles = Partial<Record<EqProfile, string>>

export interface DeleteSavedEqResult {
  success: boolean
  code?: 'INVALID_EQ_FILES' | 'PROTECTED_EQ' | 'EQ_IN_USE' | 'EQ_NOT_FOUND' | 'EQ_DELETE_FAILED'
  deleted?: number
}

export interface PreampSettings {
  enabled: boolean
  value: number
}

export interface V5Preset {
  id: string
  name: string
  profile: string
  weaponTuning: string
  filename: string
}

export interface HeadphoneEq {
  id: string
  name: string
  relativePath: string
  brand?: string
  model?: string
  source?: string
  type?: string
  aliases?: string[]
  channel: 'Average'
}

export interface AutoEqSummary {
  outputFile: string
  headphoneName: string
  source: string | null
  channel: 'Average'
  target: string
  smoothing: 5
  range: '20-7500 Hz'
  meanError: number
  maxError: number
}

export interface HeadphoneSearchResult {
  total: number
  matchCount: number
  results: HeadphoneEq[]
}

export interface AutoEqGenerationProgress {
  completed: number
  total: 3
  profile: 'AT V1' | 'AIW V3' | 'AIW V5'
  phase: 'generating' | 'completed'
  percent: number
}

export interface V5Readiness {
  presetLibrary: boolean
  measurementsLibrary: boolean
  targetsLibrary: boolean
  plugins: Record<'vstV1' | 'vstV2' | 'jsfxEngine' | 'jsfxEnhancer', boolean>
}

export interface ApplyResult {
  success: boolean
  restarted?: boolean
  code?: string
  autoEq?: AutoEqSummary
  generatedEqs?: Record<'atV1' | 'aiwV3' | 'aiwV5', AutoEqSummary>
}

export interface V5ActiveState {
  tuneFilename: string | null
  headphoneEqFilename: string | null
  headphoneName: string | null
  headphoneSource: string | null
  headphoneChannel: string | null
  headphoneTarget: string | null
  headphoneFitError: string | null
}

export type { PluginLibraryResult, BuiltinPluginProfile, PluginParameterId, PluginProfile, PluginResult, PluginSnapshot } from '../../shared/plugin-control'
