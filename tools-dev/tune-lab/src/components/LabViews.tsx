import { useMemo, useState } from 'react'
import { FiCheck, FiDownload, FiPlay, FiSquare, FiTrash2 } from 'react-icons/fi'
import { analyzeFrame } from '../audio/analysis'
import type { AnalysisFrame, LabSession, NativeAudioDevice } from '../types'

const NATIVE_URL = 'http://127.0.0.1:4179'
const LABELS = ['FL', 'FR', 'FC', 'LFE', 'BL', 'BR', 'SL', 'SR', 'OFL', 'OFR', 'TL', 'TR', 'BwL', 'BwR', 'BkL', 'BkR']

interface CalibrationProps { device?: NativeAudioDevice; onError: (message: string) => void }
export function CalibrationView({ device, onError }: CalibrationProps) {
  const [playing, setPlaying] = useState(0)
  const [verified, setVerified] = useState<Set<number>>(() => new Set())
  const play = async (channel: number) => {
    if (!device) return
    setPlaying(channel); onError('')
    try {
      const response = await fetch(`${NATIVE_URL}/calibration/play`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: device.id, channel, frequency: 500, gainDb: -24, durationMs: 1200 }) })
      if (!response.ok) { const result = await response.json() as { error?: string }; throw new Error(result.error || 'Unable to play the channel tone.') }
      window.setTimeout(() => setPlaying(current => current === channel ? 0 : current), 1250)
    } catch (reason) { setPlaying(0); onError(reason instanceof Error ? reason.message : 'Unable to play the channel tone.') }
  }
  const toggle = (channel: number) => setVerified(current => { const next = new Set(current); next.has(channel) ? next.delete(channel) : next.add(channel); return next })
  return <div className="lab-view calibration-view">
    <div className="view-heading"><div><h3>Channel calibration</h3><p>Play a reduced-level tone through exactly one WASAPI channel, then confirm the physical position you hear.</p></div><div className="verification-count">{verified.size} / {device?.channels ?? 0} verified</div></div>
    <div className="safety-note">Calibration is limited to 500 Hz, −24 dB and 1.2 seconds. Lower your listening volume before starting.</div>
    <div className="calibration-grid">{Array.from({ length: device?.channels ?? 0 }, (_, index) => {
      const channel = index + 1; const confirmed = verified.has(channel)
      return <div className={`calibration-row ${confirmed ? 'confirmed' : ''}`} key={channel}><span className="channel-index">{String(channel).padStart(2, '0')}</span><strong>{LABELS[index] ?? `CH${channel}`}</strong><button className={playing === channel ? 'playing' : ''} onClick={() => void play(channel)}><FiPlay />{playing === channel ? 'Playing' : 'Test'}</button><button className="verify-button" onClick={() => toggle(channel)}>{confirmed ? <FiCheck /> : null}{confirmed ? 'Verified' : 'Confirm'}</button></div>
    })}</div>
    {!device ? <div className="empty-view">Start the WASAPI helper and select an active endpoint.</div> : null}
  </div>
}

export function MaskingView({ frame }: { frame: AnalysisFrame }) {
  const metrics = useMemo(() => analyzeFrame(frame), [frame])
  const severity = metrics.maskingDb > 6 ? 'high' : metrics.maskingDb > 0 ? 'moderate' : 'clear'
  const low = Math.round(metrics.lowEnergy * 100); const cue = Math.round(metrics.cueEnergy * 100)
  return <div className="lab-view masking-view">
    <div className="view-heading"><div><h3>Real-time masking audit</h3><p>Compares low-frequency pressure against the 1.2–6.5 kHz cue band using measured endpoint samples.</p></div><div className={`masking-status ${severity}`}>{severity === 'high' ? 'High masking' : severity === 'moderate' ? 'Moderate' : 'Cue band clear'}</div></div>
    <div className="masking-score"><span>Low / cue relationship</span><strong>{metrics.maskingDb.toFixed(1)} dB</strong><small>Positive values mean low-frequency energy is dominating the cue band.</small></div>
    <div className="band-comparison"><EnergyBand label="Low pressure" range="40–280 Hz" value={low} tone="low" /><EnergyBand label="Cue detail" range="1.2–6.5 kHz" value={cue} tone="cue" /></div>
    <div className="audit-grid"><AuditMetric label="Peak" value={`${frame.peak.toFixed(1)} dBFS`} /><AuditMetric label="Headroom" value={`${frame.headroom.toFixed(1)} dB`} /><AuditMetric label="Channels" value={String(frame.channels.length)} /><AuditMetric label="Sample rate" value={`${Math.round(frame.sampleRate / 1000)} kHz`} /></div>
    <div className="interpretation"><strong>Interpretation</strong><p>{severity === 'high' ? 'Bass or broadband pressure is likely covering short high-frequency events. Capture this section in both A and B before changing a tune.' : severity === 'moderate' ? 'The cue band remains present, but low-frequency content is competing with it.' : 'The measured cue band currently has equal or greater relative energy than the low band.'}</p></div>
  </div>
}

function EnergyBand({ label, range, value, tone }: { label: string; range: string; value: number; tone: string }) { return <div className="energy-band"><div><strong>{label}</strong><span>{range}</span></div><div className="energy-track"><i className={tone} style={{ width: `${Math.min(100, value)}%` }} /></div><b>{value}%</b></div> }
function AuditMetric({ label, value }: { label: string; value: string }) { return <div className="audit-metric"><span>{label}</span><strong>{value}</strong></div> }

interface SessionsProps { sessions: Partial<Record<'A' | 'B', LabSession>>; recordingSlot: 'A' | 'B' | null; onStart: (slot: 'A' | 'B') => void; onStop: () => void; onClear: (slot: 'A' | 'B') => void }
export function SessionsView({ sessions, recordingSlot, onStart, onStop, onClear }: SessionsProps) {
  return <div className="lab-view sessions-view"><div className="view-heading"><div><h3>A/B measurement sessions</h3><p>Record the same controlled passage twice. Metrics are sampled at 10 Hz and native captures are saved as multichannel WAV.</p></div></div><div className="session-columns">{(['A', 'B'] as const).map(slot => <SessionCard key={slot} slot={slot} session={sessions[slot]} recording={recordingSlot === slot} disabled={Boolean(recordingSlot && recordingSlot !== slot)} onStart={onStart} onStop={onStop} onClear={onClear} />)}</div><Comparison sessions={sessions} /></div>
}

function SessionCard({ slot, session, recording, disabled, onStart, onStop, onClear }: { slot: 'A' | 'B'; session?: LabSession; recording: boolean; disabled: boolean; onStart: (slot: 'A' | 'B') => void; onStop: () => void; onClear: (slot: 'A' | 'B') => void }) {
  return <div className={`session-card ${recording ? 'recording' : ''}`}><header><span>SESSION {slot}</span>{recording ? <i>RECORDING</i> : session ? <i className="saved">CAPTURED</i> : null}</header>{session ? <><div className="session-source">{session.source}</div><div className="session-stats"><AuditMetric label="Duration" value={`${session.duration.toFixed(1)} s`} /><AuditMetric label="Avg RMS" value={`${session.summary.averageRms.toFixed(1)} dB`} /><AuditMetric label="Masking" value={`${session.summary.averageMaskingDb.toFixed(1)} dB`} /><AuditMetric label="Min headroom" value={`${session.summary.minimumHeadroom.toFixed(1)} dB`} /></div><small className="wave-path">{session.wavePath ?? 'Metrics-only session'}</small></> : <div className="session-empty">No measurement captured</div>}<footer>{recording ? <button className="stop-record" onClick={onStop}><FiSquare />Stop</button> : <button disabled={disabled} onClick={() => onStart(slot)}><span className="record-dot" />Record {slot}</button>}{session && !recording ? <button className="clear-session" onClick={() => onClear(slot)}><FiTrash2 /></button> : null}</footer></div>
}

function Comparison({ sessions }: { sessions: Partial<Record<'A' | 'B', LabSession>> }) {
  const a = sessions.A?.summary; const b = sessions.B?.summary
  if (!a || !b) return <div className="comparison-placeholder">Capture both sessions to unlock measured A/B deltas.</div>
  const rows = [{ label: 'Average masking', a: a.averageMaskingDb, b: b.averageMaskingDb, lower: true, suffix: ' dB' }, { label: 'Minimum headroom', a: a.minimumHeadroom, b: b.minimumHeadroom, lower: false, suffix: ' dB' }, { label: 'Average RMS', a: a.averageRms, b: b.averageRms, lower: false, suffix: ' dBFS' }]
  return <div className="comparison"><header><strong>Measured comparison</strong><span>Difference B − A</span></header>{rows.map(row => { const delta = row.b - row.a; const better = row.lower ? delta < 0 : delta > 0; return <div className="comparison-row" key={row.label}><span>{row.label}</span><b>{row.a.toFixed(1)}{row.suffix}</b><b>{row.b.toFixed(1)}{row.suffix}</b><strong className={better ? 'positive' : delta === 0 ? '' : 'negative'}>{delta > 0 ? '+' : ''}{delta.toFixed(1)}{row.suffix}</strong></div>})}</div>
}

export function ReportsView({ sessions }: { sessions: Partial<Record<'A' | 'B', LabSession>> }) {
  const exportReport = () => { const body = JSON.stringify({ generatedAt: new Date().toISOString(), methodology: { sampleIntervalMs: 100, lowBandHz: [40, 280], cueBandHz: [1200, 6500], claims: 'Signal metrics only; no game-state inference.' }, sessions }, null, 2); const url = URL.createObjectURL(new Blob([body], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `astral-tune-audit-${Date.now()}.json`; anchor.click(); URL.revokeObjectURL(url) }
  const count = Number(Boolean(sessions.A)) + Number(Boolean(sessions.B))
  return <div className="lab-view reports-view"><div className="view-heading"><div><h3>Audit report</h3><p>Exports traceable session metrics, events, methodology and native WAV locations without modifying the active tune.</p></div></div><div className="report-summary"><strong>{count} / 2 sessions ready</strong><span>{sessions.A?.source ?? sessions.B?.source ?? 'No capture source recorded'}</span><button disabled={!count} onClick={exportReport}><FiDownload />Export audit JSON</button></div><div className="report-notes"><strong>Included</strong><ul><li>10 Hz metric timeline and per-channel RMS</li><li>Masking relationship for low and cue bands</li><li>Peak, RMS, minimum headroom and event markers</li><li>Paths to locally recorded multichannel WAV files</li></ul><strong>Not claimed</strong><ul><li>Enemy identity, exact distance, walls or map position</li><li>Automatic tune quality without controlled A/B listening</li></ul></div></div>
}
