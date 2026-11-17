import fs from 'node:fs'
import path from 'node:path'
import type { V5Game } from '../shared/v5-catalog'

export function matchingGameEq(currentFile: string, game: V5Game): string | null {
  if (!fs.existsSync(currentFile)) return null
  const metadata = (file: string) => {
    const text = fs.readFileSync(file, 'utf8')
    const field = (name: string) => text.match(new RegExp(`^# ${name}:\\s*(.+)$`, 'mi'))?.[1].trim()
    return { target: field('Target'), source: field('Source file') }
  }
  const current = metadata(currentFile)
  const target = `${game} Target V5`
  if (current.target === target) return currentFile
  if (!current.source) return null
  const matches = fs.readdirSync(path.dirname(currentFile), { withFileTypes: true }).flatMap(entry => {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.txt')) return []
    const file = path.join(path.dirname(currentFile), entry.name)
    const candidate = metadata(file)
    return candidate.target === target && candidate.source === current.source ? [file] : []
  })
  return matches.length === 1 ? matches[0] : null
}
