import { useEffect, useState } from 'react'
import { FiActivity, FiCircle, FiDownload, FiFileText, FiMap, FiPause, FiPlay, FiRadio, FiSettings, FiSliders, FiTarget, FiVolume2 } from 'react-icons/fi'
import { useAudioAnalysis } from './audio/useAudioAnalysis'
import { useLabSessions } from './audio/useLabSessions'
import SpatialMap from './components/SpatialMap'
import SpectrumCanvas from './components/SpectrumCanvas'
import { CalibrationView, MaskingView, ReportsView, SessionsView } from './components/LabViews'

const formatTime = (seconds: number) => new Date(seconds * 1000).toISOString().slice(11, 19)
const formatDb = (value: number) => `${value.toFixed(1)} dBFS`

export default function App() {
  const { frame, events, error, devices, selectedDevice, setSelectedDevice, nativeAvailable, captureDevice, capture, demo, pause, mark } = useAudioAnalysis()
  const [view, setView] = useState(() => new URLSearchParams(window.location.search).get('view') || 'Live Monitor')
  const [session, setSession] = useState<'A' | 'B'>('A')
  const [viewError, setViewError] = useState('')
  const sessionRecorder = useLabSessions(frame, events)
  const live = frame.mode === 'live' || frame.mode === 'demo'
  const selectedInfo = devices.find(device => device.id === selectedDevice)
  useEffect(() => { if (new URLSearchParams(window.location.search).has('demo')) demo() }, [demo])

  return <main className="app-shell">
    <header className="titlebar"><div className="brand"><span className="brand-mark"><FiActivity /></span><strong>Astral Tune Lab</strong><small>Developer Preview</small></div><div className={`live-state ${live ? 'on' : ''}`}><i />{frame.mode === 'demo' ? 'DEMO SIGNAL' : live ? 'LIVE CAPTURE' : frame.mode.toUpperCase()}</div><time>{formatTime(frame.elapsed)}</time></header>
    <aside className="sidebar">
      <nav>{[['Live Monitor', FiRadio], ['Masking', FiActivity], ['Spatial Map', FiMap], ['Calibration', FiVolume2], ['A/B Sessions', FiSliders], ['Reports', FiFileText]].map(([label, Icon]) => <button className={view === label ? 'active' : ''} onClick={() => setView(label as string)} key={label as string}><Icon />{label as string}</button>)}</nav>
      <button className="settings"><FiSettings />Settings</button>
    </aside>
    <section className="left-panel">
      <PanelTitle title="Monitor" />
      <label className="field-label">WASAPI output device</label><select className="source-field device-select" value={selectedDevice} onChange={event => setSelectedDevice(event.target.value)} disabled={!nativeAvailable}>{nativeAvailable ? devices.map(device => <option value={device.id} key={device.id}>{device.name} · {device.channels}ch · {Math.round(device.sampleRate / 1000)} kHz</option>) : <option>Start the WASAPI helper</option>}</select>
      <div className={`helper-state ${nativeAvailable ? 'ready' : ''}`}><i />{nativeAvailable ? `${devices.length} endpoints · ${selectedInfo?.channels ?? 0}ch · ${Math.round((selectedInfo?.sampleRate ?? 0) / 1000)} kHz` : 'Native helper offline'}</div>
      <dl className="spec-list"><div><dt>Sample rate</dt><dd>{Math.round(frame.sampleRate / 1000)} kHz</dd></div><div><dt>Capture format</dt><dd>{frame.bitsPerSample ? `${frame.bitsPerSample}-bit engine` : '—'}</dd></div><div><dt>Signal channels</dt><dd>{frame.activeChannelCount} active / {frame.channels.length} format</dd></div><div><dt>Topology</dt><dd>{frame.topology === 'stereo' ? 'Binaural / stereo' : frame.topology}</dd></div></dl>
      <PanelTitle title="Levels" />
      <div className="big-level"><span>Master peak</span><strong className={frame.peak > -1 ? 'danger' : ''}>{formatDb(frame.peak)}</strong></div>
      <Meter value={frame.peak} />
      <dl className="spec-list levels"><div><dt>RMS</dt><dd>{formatDb(frame.rms)}</dd></div><div><dt>Headroom</dt><dd className="healthy">{frame.headroom.toFixed(1)} dB</dd></div><div><dt>Clipping</dt><dd>{frame.peak > -0.2 ? 'Detected' : 'None'}</dd></div></dl>
      <div className="health"><FiCircle />{frame.peak > -0.2 ? 'Reduce level before testing' : 'No clipping detected'}</div>
    </section>
    <section className={`canvas-panel view-${view.toLocaleLowerCase().replaceAll(/[^a-z]+/g, '-')}`}>
      {view === 'Live Monitor' || view === 'Spatial Map' ? <><div className="canvas-toolbar"><PanelTitle title={view} /><span>{frame.topology === 'stereo' ? 'BINAURAL VIEW' : 'ENERGY VIEW'}</span></div><SpatialMap channels={frame.channels} topology={frame.topology} balance={frame.balance} correlation={frame.correlation} stereoWidth={frame.stereoWidth} /></> : null}
      {view === 'Masking' ? <MaskingView frame={frame} /> : null}
      {view === 'Calibration' ? <CalibrationView device={selectedInfo} onError={setViewError} /> : null}
      {view === 'A/B Sessions' ? <SessionsView sessions={sessionRecorder.sessions} recordingSlot={sessionRecorder.recordingSlot} onStart={slot => void sessionRecorder.start(slot)} onStop={() => void sessionRecorder.stop()} onClear={sessionRecorder.clear} /> : null}
      {view === 'Reports' ? <ReportsView sessions={sessionRecorder.sessions} /> : null}
    </section>
    <aside className="inspector">
      <PanelTitle title="Source" />
      <dl className="spec-list"><div><dt>Engine</dt><dd>{nativeAvailable ? 'Native WASAPI loopback' : 'Web Audio fallback'}</dd></div><div><dt>Signal</dt><dd>{frame.source}</dd></div><div><dt>Status</dt><dd className={live ? 'healthy' : ''}>{frame.mode.toUpperCase()}</dd></div></dl>
      <PanelTitle title="Detected events" />
      <div className="events">{events.length ? events.map(event => <div className="event" key={event.id}><i className={event.severity} /><span><strong>{event.kind}</strong><small>{event.timestamp} · {event.channel}</small></span></div>) : <div className="empty">No measured events yet</div>}</div>
      <PanelTitle title={`Channels (${frame.activeChannelCount} active / ${frame.channels.length})`} />
      <div className="channel-table"><div className="table-head"><span>#</span><span>Label</span><span>Peak</span><span>RMS</span></div>{frame.channels.map(channel => <div className="table-row" key={channel.index}><span>{channel.index}</span><strong>{channel.label}</strong><span>{channel.peak.toFixed(1)}</span><span>{channel.rms.toFixed(1)}</span></div>)}</div>
    </aside>
    <section className="spectrum-panel"><div className="spectrum-head"><PanelTitle title="Spectrum" /><span>20 Hz — 20 kHz</span><span className="push">FFT 2048</span></div><SpectrumCanvas frequency={frame.frequency} events={events.length} /></section>
    <footer className="transport">
      <button className="capture" onClick={() => void captureDevice()} disabled={!nativeAvailable || !selectedDevice}><span><FiCircle /></span><b>{live ? 'Change device' : 'Capture device'}</b></button>
      <button onClick={pause} disabled={frame.mode !== 'live' && frame.mode !== 'paused'}>{frame.mode === 'paused' ? <FiPlay /> : <FiPause />}{frame.mode === 'paused' ? 'Resume' : 'Pause'}</button>
      <button onClick={mark}><FiTarget />Mark event</button>
      <button onClick={() => void capture()}><FiRadio />Screen mix</button>
      <button onClick={demo}><FiActivity />Demo signal</button>
      <div className="ab"><span>A / B</span><button className={session === 'A' ? 'active' : ''} onClick={() => setSession('A')}>A</button><button className={session === 'B' ? 'active' : ''} onClick={() => setSession('B')}>B</button></div>
      <button className="export" onClick={() => downloadReport(frame, events, session)}><FiDownload />Export report</button>
      {error || sessionRecorder.error || viewError ? <div className="capture-error">{error || sessionRecorder.error || viewError}</div> : null}
    </footer>
  </main>
}

function PanelTitle({ title }: { title: string }) { return <h2 className="panel-title">{title}<span /></h2> }
function Meter({ value }: { value: number }) { return <div className="meter"><div style={{ width: `${Math.max(0, Math.min(100, ((value + 60) / 60) * 100))}%` }} /><i style={{ left: `${Math.max(0, Math.min(100, ((value + 60) / 60) * 100))}%` }} /></div> }
function downloadReport(frame: ReturnType<typeof useAudioAnalysis>['frame'], events: ReturnType<typeof useAudioAnalysis>['events'], session: 'A' | 'B') {
  const payload = JSON.stringify({ generatedAt: new Date().toISOString(), session, capture: { source: frame.source, sampleRate: frame.sampleRate, mode: frame.mode }, metrics: { peakDbfs: frame.peak, rmsDbfs: frame.rms, headroomDb: frame.headroom, channels: frame.channels }, events }, null, 2)
  const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `astral-tune-lab-${session}-${Date.now()}.json`; anchor.click(); URL.revokeObjectURL(url)
}
