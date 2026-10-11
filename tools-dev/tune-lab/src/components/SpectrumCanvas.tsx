import { memo, useEffect, useRef } from 'react'

interface Props { frequency: Uint8Array; events: number }

function SpectrumCanvas({ frequency, events }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const historyRef = useRef<ImageData[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.max(1, rect.width * ratio)
    canvas.height = Math.max(1, rect.height * ratio)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(ratio, ratio)
    const width = rect.width
    const height = rect.height
    ctx.clearRect(0, 0, width, height)
    ctx.strokeStyle = 'rgba(255,255,255,.055)'
    ctx.lineWidth = 1
    for (let x = 0; x <= width; x += width / 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke() }
    for (let y = 0; y <= height; y += height / 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke() }
    ctx.beginPath()
    frequency.forEach((value, index) => {
      const x = (Math.log10(index + 1) / Math.log10(frequency.length)) * width
      const y = height - (value / 255) * (height - 12)
      index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    })
    ctx.strokeStyle = '#a45cff'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.closePath()
    const fill = ctx.createLinearGradient(0, 0, 0, height)
    fill.addColorStop(0, 'rgba(155,77,255,.24)'); fill.addColorStop(1, 'rgba(155,77,255,0)')
    ctx.fillStyle = fill; ctx.fill()
    ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = '#777783'
    ;['20', '50', '100', '200', '500', '1k', '2k', '5k', '10k', '20k'].forEach((label, index, labels) => ctx.fillText(label, (index / (labels.length - 1)) * (width - 18), height - 5))
    historyRef.current = historyRef.current.slice(-10)
  }, [frequency, events])

  return <canvas ref={canvasRef} className="spectrum-canvas" aria-label="Real-time frequency spectrum" />
}

export default memo(SpectrumCanvas)
