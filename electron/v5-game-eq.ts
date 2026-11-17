import fs from 'node:fs'
import path from 'node:path'
import type { V5Game } from '../shared/v5-catalog'

export function matchingGameEq(currentFile: string, game: V5Game): string | null {
  try { if (!fs.statSync(currentFile).isFile()) return null } catch { return null }
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
  return equivalentMatch(matches)
}

// Allow the first explicit headphone selection before a tune has been chosen.
// Never substitute another game's file for this initial selection.
export function initialGameEq(file:string):string|null {
  for(const game of ['BO7','MW4'] as const)if(matchingGameEq(file,game)===file)return file
  return null
}

export function headphoneSource(file:string):string|null {
  try { if(!fs.statSync(file).isFile())return null;return fs.readFileSync(file,'utf8').match(/^# Source file:\s*(.+)$/mi)?.[1].trim() ?? null }catch{return null}
}
export function selectedHeadphone(current:string|null, legacy:string[]):string|null {
  if(current && headphoneSource(current))return current
  const candidates=legacy.filter(file=>headphoneSource(file))
  const sources=new Set(candidates.map(headphoneSource))
  return sources.size===1?candidates[0]:null
}
export function gameEqForHeadphone(anchor:string,folder:string,game:V5Game):string|null {
  const source=headphoneSource(anchor);if(!source || !fs.existsSync(folder))return null
  const matches=fs.readdirSync(folder,{withFileTypes:true}).filter(e=>e.isFile()&&e.name.toLowerCase().endsWith('.txt')).map(e=>path.join(folder,e.name)).filter(file=>headphoneSource(file)===source && fs.readFileSync(file,'utf8').match(/^# Target:\s*(.+)$/mi)?.[1].trim()===game+' Target V5')
  if(matches.includes(anchor))return anchor
  return equivalentMatch(matches)
}
function equivalentMatch(files:string[]):string|null {
 if(files.length===1)return files[0]
 // Renamed legacy files can coexist after migration. Identical bytes are safe;
 // different EQs for the same source must still be treated as ambiguous.
 if(files.length>1&&files.every(file=>fs.readFileSync(file).equals(fs.readFileSync(files[0]))))return [...files].sort()[0]
 return null
}
