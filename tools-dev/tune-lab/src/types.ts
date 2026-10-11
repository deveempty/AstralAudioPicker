export type CaptureMode = 'idle' | 'live' | 'paused' | 'demo' | 'error'

export interface ChannelMetric {
  index: number
  label: string
  peak: number
  rms: number
}

export interface AudioEvent {
  id: number
  kind: 'Transient' | 'Broadband burst' | 'Low-frequency masking'
  timestamp: string
  channel: string
  severity: 'info' | 'warn' | 'hot'
}

export interface AnalysisFrame {
  frequency: Uint8Array
  waveform: Uint8Array
  channels: ChannelMetric[]
  peak: number
  rms: number
  headroom: number
  sampleRate: number
  bitsPerSample: number
  elapsed: number
  mode: CaptureMode
  source: string
  topology: 'silent' | 'stereo' | 'multichannel'
  activeChannelCount: number
  balance: number
  correlation: number
  stereoWidth: number
}

export interface NativeAudioDevice {
  id: string
  name: string
  channels: number
  sampleRate: number
  bitsPerSample: number
}

export interface SessionFrame {
  at: number
  peak: number
  rms: number
  headroom: number
  lowEnergy: number
  cueEnergy: number
  maskingDb: number
  channels: number[]
}

export interface LabSession {
  id: string
  slot: 'A' | 'B'
  source: string
  sampleRate: number
  channels: number
  startedAt: string
  duration: number
  wavePath?: string
  frames: SessionFrame[]
  events: AudioEvent[]
  summary: SessionSummary
}

export interface SessionSummary {
  averagePeak: number
  averageRms: number
  minimumHeadroom: number
  averageLowEnergy: number
  averageCueEnergy: number
  averageMaskingDb: number
  transientCount: number
}
