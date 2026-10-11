import type { AnalysisFrame, SessionFrame, SessionSummary } from '../types'

function rangeAverage(frequency: Uint8Array, sampleRate: number, fromHz: number, toHz: number) {
  const nyquist = sampleRate / 2
  const usableBins = frequency.length > 512 && frequency.slice(512).every(value => value === 0) ? 512 : frequency.length
  const from = Math.max(1, Math.floor((fromHz / nyquist) * usableBins))
  const to = Math.min(usableBins - 1, Math.ceil((toHz / nyquist) * usableBins))
  let total = 0
  for (let index = from; index <= to; index++) total += frequency[index] / 255
  return total / Math.max(1, to - from + 1)
}

export function analyzeFrame(frame: AnalysisFrame): SessionFrame {
  const lowEnergy = rangeAverage(frame.frequency, frame.sampleRate, 40, 280)
  const cueEnergy = rangeAverage(frame.frequency, frame.sampleRate, 1200, 6500)
  return {
    at: frame.elapsed,
    peak: frame.peak,
    rms: frame.rms,
    headroom: frame.headroom,
    lowEnergy,
    cueEnergy,
    maskingDb: 20 * Math.log10((lowEnergy + .001) / (cueEnergy + .001)),
    channels: frame.channels.map(channel => channel.rms),
  }
}

export function summarize(frames: SessionFrame[], transientCount: number): SessionSummary {
  if (!frames.length) return { averagePeak: -60, averageRms: -60, minimumHeadroom: 60, averageLowEnergy: 0, averageCueEnergy: 0, averageMaskingDb: 0, transientCount }
  const average = (read: (frame: SessionFrame) => number) => frames.reduce((total, frame) => total + read(frame), 0) / frames.length
  return {
    averagePeak: average(frame => frame.peak),
    averageRms: average(frame => frame.rms),
    minimumHeadroom: Math.min(...frames.map(frame => frame.headroom)),
    averageLowEnergy: average(frame => frame.lowEnergy),
    averageCueEnergy: average(frame => frame.cueEnergy),
    averageMaskingDb: average(frame => frame.maskingDb),
    transientCount,
  }
}
