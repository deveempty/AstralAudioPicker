import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioAnalyzer } from './AudioAnalyzer'
import type { AnalysisFrame, AudioEvent, NativeAudioDevice } from '../types'

const NATIVE_URL = 'http://127.0.0.1:4179'
const EMPTY = { frequency: new Uint8Array(1024), waveform: new Uint8Array(2048).fill(128), channels: [], peak: -60, rms: -60, headroom: 60, sampleRate: 48000, bitsPerSample: 0, elapsed: 0, mode: 'idle', source: 'No source', topology: 'silent', activeChannelCount: 0, balance: 0, correlation: 0, stereoWidth: 0 } satisfies AnalysisFrame

interface NativeFrame {
  active: boolean; source: string; channels: number; sampleRate: number; bitsPerSample: number
  peak: number; rms: number; headroom: number; frequency: number[]; channelLevels: AnalysisFrame['channels']; elapsed: number
  topology: AnalysisFrame['topology']; activeChannelCount: number; balance: number; correlation: number; stereoWidth: number
}

export function useAudioAnalysis() {
  const engine = useRef(new AudioAnalyzer())
  const [frame, setFrame] = useState<AnalysisFrame>(EMPTY)
  const [events, setEvents] = useState<AudioEvent[]>([])
  const [error, setError] = useState('')
  const [devices, setDevices] = useState<NativeAudioDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState('')
  const [nativeAvailable, setNativeAvailable] = useState(false)
  const nativeActive = useRef(false)
  const nativeFrame = useRef<AnalysisFrame | null>(null)
  const lastNativeEvent = useRef(0)

  useEffect(() => {
    let frameId = 0
    let lastUi = 0
    const update = (now: number) => {
      if (now - lastUi > 65) {
        setFrame(nativeActive.current && nativeFrame.current ? nativeFrame.current : engine.current.read())
        if (!nativeActive.current) setEvents(engine.current.getEvents())
        lastUi = now
      }
      frameId = requestAnimationFrame(update)
    }
    frameId = requestAnimationFrame(update)
    return () => { cancelAnimationFrame(frameId); void engine.current.stop() }
  }, [])

  useEffect(() => {
    let disposed = false
    const loadDevices = async () => {
      try {
        const response = await fetch(`${NATIVE_URL}/devices`)
        if (!response.ok) throw new Error('Native capture helper unavailable')
        const result = await response.json() as NativeAudioDevice[]
        if (disposed) return
        setDevices(result)
        setNativeAvailable(true)
        setSelectedDevice(current => current || result.find(device => /cable (input 7\.1|in 16ch)/i.test(device.name))?.id || result[0]?.id || '')
      } catch { if (!disposed) { setNativeAvailable(false); setDevices([]) } }
    }
    void loadDevices()
    const refreshId = window.setInterval(loadDevices, 2500)
    return () => { disposed = true; window.clearInterval(refreshId) }
  }, [])

  useEffect(() => {
    let disposed = false
    const poll = async () => {
      if (!nativeActive.current) return
      try {
        const response = await fetch(`${NATIVE_URL}/frame`)
        const result = await response.json() as NativeFrame
        if (disposed || !result.active) return
        const frequency = new Uint8Array(1024)
        result.frequency.forEach((value, index) => { frequency[index] = Math.round(Math.max(0, Math.min(1, value)) * 255) })
        nativeFrame.current = { frequency, waveform: new Uint8Array(2048).fill(128), channels: result.channelLevels, peak: result.peak, rms: result.rms, headroom: result.headroom, sampleRate: result.sampleRate, bitsPerSample: result.bitsPerSample, elapsed: result.elapsed, mode: 'live', source: result.source, topology: result.topology, activeChannelCount: result.activeChannelCount, balance: result.balance, correlation: result.correlation, stereoWidth: result.stereoWidth }
        if (performance.now() - lastNativeEvent.current > 2200 && result.peak > -12) {
          lastNativeEvent.current = performance.now()
          const loudest = result.channelLevels.reduce((best, channel) => channel.peak > best.peak ? channel : best, result.channelLevels[0])
          const measuredEvent: AudioEvent = { id: Date.now(), kind: result.peak > -3 ? 'Transient' : 'Broadband burst', timestamp: new Date().toLocaleTimeString([], { hour12: false }), channel: loudest?.label ?? 'Mix', severity: result.peak > -3 ? 'hot' : 'info' }
          setEvents(current => [measuredEvent, ...current].slice(0, 8))
        }
      } catch { nativeActive.current = false; setError('The WASAPI helper stopped responding.') }
    }
    const pollId = window.setInterval(poll, 70)
    return () => { disposed = true; window.clearInterval(pollId) }
  }, [])

  const capture = useCallback(async () => {
    setError('')
    try { await engine.current.startLoopback() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to capture the selected output.') }
  }, [])

  const captureDevice = useCallback(async () => {
    if (!selectedDevice) return
    setError('')
    try {
      await engine.current.stop()
      const response = await fetch(`${NATIVE_URL}/capture/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: selectedDevice }) })
      if (!response.ok) { const failure = await response.json() as { error?: string }; throw new Error(failure.error || 'Unable to start WASAPI capture.') }
      nativeActive.current = true
      setEvents([])
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to start WASAPI capture.') }
  }, [selectedDevice])

  const demo = useCallback(() => { nativeActive.current = false; void engine.current.startDemo() }, [])
  const pause = useCallback(() => engine.current.togglePause(), [])
  const mark = useCallback(() => engine.current.markEvent(), [])

  return { frame, events, error, devices, selectedDevice, setSelectedDevice, nativeAvailable, captureDevice, capture, demo, pause, mark }
}
