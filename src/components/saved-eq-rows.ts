import type {AutoEqLibraryGroup,EqProfile} from '../types/electron'
export type EqColumn=EqProfile|'aiwMW4'
type AutoEqFile=AutoEqLibraryGroup['files'][number]
export function savedEqRows(groups:AutoEqLibraryGroup[]){
    const records = new Map<string, { name: string; versions: Partial<Record<EqColumn, AutoEqFile>> }>()
    groups.forEach(group => group.files.forEach(file => {
      const mw4=group.id==='aiwV5' && /^MW4 Target V[15]$/.test(file.target??'')
      const key = (mw4?file.name.replace(/ - MW4 V[15]$/i,''):file.name).toLocaleLowerCase()
      const displayName = `${file.headphoneName}${file.source ? ` - ${file.source}` : ''}`
      const record = records.get(key) ?? { name: displayName, versions: {} }
      const column:EqColumn=mw4?'aiwMW4':group.id
      if(!record.versions[column] || file.target!=='MW4 Target V1')record.versions[column] = file
      records.set(key, record)
    }))
  return [...records.values()]
}
