import { memo } from 'react'
import type { AnalysisFrame, ChannelMetric } from '../types'

interface Props { channels: ChannelMetric[]; topology: AnalysisFrame['topology']; balance: number; correlation: number; stereoWidth: number }

function SpatialMap({ channels, topology, balance, correlation, stereoWidth }: Props) {
  if (topology === 'stereo') return <div className="binaural-map">
    <div className="binaural-title"><strong>Binaural / stereo signal</strong><span>16-channel endpoint · FL/FR carrying audio</span></div>
    <div className="stereo-field"><span>LEFT</span><i className="stereo-center" /><b style={{ left: `${50 + balance * 42}%` }} /><span>RIGHT</span></div>
    <div className="binaural-stats"><div><small>L/R energy balance</small><strong>{balance < -.08 ? `${Math.round(Math.abs(balance) * 100)}% left` : balance > .08 ? `${Math.round(balance * 100)}% right` : 'Centered'}</strong></div><div><small>Correlation</small><strong>{correlation.toFixed(2)}</strong></div><div><small>Stereo width</small><strong>{Math.round(stereoWidth * 100)}%</strong></div></div>
    <p>Spatial direction is encoded inside the FL/FR waveform. Channels 3–16 are currently silent, so they are not discrete sound sources.</p>
  </div>
  return <div className="spatial-map">
    <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" />
    <div className="listener"><div className="head" /><div className="shoulders" /></div>
    {channels.map((channel, index) => {
      const angle = (index / 16) * Math.PI * 2 - Math.PI / 2
      const radius = index > 7 ? 41 : 34
      const x = 50 + Math.cos(angle) * radius
      const y = 50 + Math.sin(angle) * radius
      const strength = Math.max(0, Math.min(1, (channel.peak + 60) / 60))
      return <div className="channel-node" key={channel.index} style={{ left: `${x}%`, top: `${y}%`, '--strength': strength } as React.CSSProperties}>
        <span>{String(channel.index).padStart(2, '0')}</span><strong>{channel.label}</strong>
      </div>
    })}
  </div>
}

export default memo(SpatialMap)
