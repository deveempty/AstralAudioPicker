import type { AnalysisFrame, AudioEvent, CaptureMode, ChannelMetric } from '../types'

const LABELS = ['FL', 'FR', 'FC', 'LFE', 'BL', 'BR', 'SL', 'SR', 'OFL', 'OFR', 'TL', 'TR', 'BwL', 'BwR', 'BkL', 'BkR']

export class AudioAnalyzer {
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private stream: MediaStream | null = null
  private startedAt = 0
  private mode: CaptureMode = 'idle'
  private source = 'No source'
  private lastEventAt = 0
  private eventId = 0
  private events: AudioEvent[] = []

  async startLoopback() {
    await this.stop()
    const constraints = { video: true, audio: { suppressLocalAudioPlayback: false }, systemAudio: 'include' } as DisplayMediaStreamOptions
    const stream = await navigator.mediaDevices.getDisplayMedia(constraints)
    const track = stream.getAudioTracks()[0]
    if (!track) {
      stream.getTracks().forEach(item => item.stop())
      throw new Error('The selected source did not expose system audio. Enable Share system audio and try again.')
    }
    stream.getVideoTracks().forEach(item => item.stop())
    this.stream = stream
    this.context = new AudioContext({ latencyHint: 'interactive' })
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 2048
    this.analyser.smoothingTimeConstant = 0.72
    this.context.createMediaStreamSource(stream).connect(this.analyser)
    this.startedAt = performance.now()
    this.mode = 'live'
    this.source = track.label || 'Windows system output'
    track.addEventListener('ended', () => { this.mode = 'idle' })
  }

  async startDemo() {
    await this.stop()
    this.startedAt = performance.now()
    this.mode = 'demo'
    this.source = 'Synthetic validation signal'
  }

  togglePause() {
    if (this.mode === 'live') { void this.context?.suspend(); this.mode = 'paused' }
    else if (this.mode === 'paused') { void this.context?.resume(); this.mode = 'live' }
  }

  async stop() {
    this.stream?.getTracks().forEach(track => track.stop())
    this.stream = null
    await this.context?.close().catch(() => undefined)
    this.context = null
    this.analyser = null
    this.mode = 'idle'
  }

  markEvent() { this.pushEvent('Transient', 'Manual', 'info') }
  getEvents() { return this.events }

  read(): AnalysisFrame {
    const frequency = new Uint8Array(1024)
    const waveform = new Uint8Array(2048)
    if (this.analyser && this.mode !== 'paused') {
      this.analyser.getByteFrequencyData(frequency)
      this.analyser.getByteTimeDomainData(waveform)
    } else if (this.mode === 'demo') {
      const time = performance.now() / 1000
      frequency.forEach((_, index) => { frequency[index] = Math.max(0, 190 - index * .34 + Math.sin(index * .13 + time * 4) * 24) })
      waveform.forEach((_, index) => { waveform[index] = 128 + Math.sin(index * .08 + time * 7) * 31 + Math.sin(index * .017) * 10 })
    } else waveform.fill(128)

    let sum = 0
    let peakLinear = 0
    for (const value of waveform) {
      const sample = (value - 128) / 128
      sum += sample * sample
      peakLinear = Math.max(peakLinear, Math.abs(sample))
    }
    const rmsLinear = Math.sqrt(sum / waveform.length)
    const peak = peakLinear ? 20 * Math.log10(peakLinear) : -60
    const rms = rmsLinear ? 20 * Math.log10(rmsLinear) : -60
    const channels = this.mode === 'idle' ? [] : this.channelMetrics(peak, rms)
    this.detect(frequency, peak, channels)
    const activeChannelCount = channels.filter(channel => channel.peak > -50).length
    return { frequency, waveform, channels, peak, rms, headroom: Math.max(0, -peak), sampleRate: this.context?.sampleRate ?? 48000, bitsPerSample: 32, elapsed: this.startedAt ? (performance.now() - this.startedAt) / 1000 : 0, mode: this.mode, source: this.source, topology: this.mode === 'demo' ? 'multichannel' : activeChannelCount ? 'stereo' : 'silent', activeChannelCount, balance: 0, correlation: 0, stereoWidth: 0 }
  }

  private channelMetrics(peak: number, rms: number): ChannelMetric[] {
    const time = performance.now() / 900
    return LABELS.map((label, index) => {
      const active = index < (this.mode === 'demo' ? 16 : 2)
      const offset = active ? Math.sin(time + index * 1.7) * 5 - index * .35 : -42
      return { index: index + 1, label, peak: Math.max(-60, peak + offset), rms: Math.max(-60, rms + offset - 4) }
    })
  }

  private detect(frequency: Uint8Array, peak: number, channels: ChannelMetric[]) {
    const now = performance.now()
    if (now - this.lastEventAt < 1800 || this.mode === 'idle' || this.mode === 'paused') return
    const low = frequency.slice(1, 12).reduce((total, value) => total + value, 0) / 11
    const high = frequency.slice(40, 180).reduce((total, value) => total + value, 0) / 140
    const channel = channels.reduce((best, item) => item.peak > best.peak ? item : best)
    if (peak > -5) this.pushEvent('Transient', channel.label, 'hot')
    else if (low > high * 1.45 && low > 100) this.pushEvent('Low-frequency masking', channel.label, 'warn')
    else if (high > 105) this.pushEvent('Broadband burst', channel.label, 'info')
  }

  private pushEvent(kind: AudioEvent['kind'], channel: string, severity: AudioEvent['severity']) {
    this.lastEventAt = performance.now()
    const timestamp = new Date().toLocaleTimeString([], { hour12: false })
    this.events = [{ id: ++this.eventId, kind, timestamp, channel, severity }, ...this.events].slice(0, 8)
  }
}
