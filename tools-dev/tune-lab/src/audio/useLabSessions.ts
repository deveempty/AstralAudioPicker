import { useCallback, useEffect, useRef, useState } from 'react'
import { analyzeFrame, summarize } from './analysis'
import type { AnalysisFrame, AudioEvent, LabSession, SessionFrame } from '../types'

const NATIVE_URL = 'http://127.0.0.1:4179'

export function useLabSessions(frame: AnalysisFrame, events: AudioEvent[]) {
  const [sessions, setSessions] = useState<Partial<Record<'A' | 'B', LabSession>>>({})
  const [recordingSlot, setRecordingSlot] = useState<'A' | 'B' | null>(null)
  const [error, setError] = useState('')
  const framesRef = useRef<SessionFrame[]>([])
  const startedRef = useRef<{ slot: 'A' | 'B'; startedAt: string; elapsed: number; source: string; sampleRate: number; channels: number } | null>(null)
  const eventIdsAtStart = useRef<Set<number>>(new Set())
  const wavePath = useRef<string | undefined>()
  const latestFrame = useRef(frame)
  latestFrame.current = frame

  useEffect(() => {
    if (!recordingSlot) return
    const sampleId = window.setInterval(() => { if (latestFrame.current.mode === 'live' || latestFrame.current.mode === 'demo') framesRef.current.push(analyzeFrame(latestFrame.current)) }, 100)
    return () => window.clearInterval(sampleId)
  }, [recordingSlot])

  const start = useCallback(async (slot: 'A' | 'B') => {
    if (frame.mode !== 'live' && frame.mode !== 'demo') { setError('Start a capture source before recording a session.'); return }
    setError('')
    framesRef.current = []
    eventIdsAtStart.current = new Set(events.map(event => event.id))
    wavePath.current = undefined
    startedRef.current = { slot, startedAt: new Date().toISOString(), elapsed: frame.elapsed, source: frame.source, sampleRate: frame.sampleRate, channels: frame.channels.length }
    if (frame.mode === 'live') {
      try {
        const response = await fetch(`${NATIVE_URL}/recording/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: `session-${slot}` }) })
        if (response.ok) wavePath.current = ((await response.json()) as { path?: string }).path
      } catch { setError('Metrics are recording, but native WAV recording could not start.') }
    }
    setRecordingSlot(slot)
  }, [events.length, frame])

  const stop = useCallback(async () => {
    const started = startedRef.current
    if (!started || !recordingSlot) return
    if (latestFrame.current.mode === 'live') {
      try { const response = await fetch(`${NATIVE_URL}/recording/stop`, { method: 'POST' }); if (response.ok) wavePath.current = ((await response.json()) as { path?: string }).path ?? wavePath.current } catch { /* metrics remain valid */ }
    }
    const capturedEvents = events.filter(event => !eventIdsAtStart.current.has(event.id))
    const sessionFrames = framesRef.current.slice()
    const session: LabSession = {
      id: `${started.slot}-${Date.now()}`,
      slot: started.slot,
      source: started.source,
      sampleRate: started.sampleRate,
      channels: started.channels,
      startedAt: started.startedAt,
      duration: Math.max(0, latestFrame.current.elapsed - started.elapsed),
      wavePath: wavePath.current,
      frames: sessionFrames,
      events: capturedEvents,
      summary: summarize(sessionFrames, capturedEvents.length),
    }
    setSessions(current => ({ ...current, [started.slot]: session }))
    setRecordingSlot(null)
    startedRef.current = null
  }, [events, recordingSlot])

  const clear = useCallback((slot: 'A' | 'B') => setSessions(current => { const next = { ...current }; delete next[slot]; return next }), [])
  return { sessions, recordingSlot, error, start, stop, clear }
}
