import fs from 'node:fs'
import path from 'node:path'

export function stableVersion(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/.test(value)
}
export function belowVersion(current: string, minimum: string): boolean {
  if (!stableVersion(current) || !stableVersion(minimum)) throw Error('UPDATE_POLICY_INVALID')
  const a=current.split('.').map(Number),b=minimum.split('.').map(Number)
  for(let i=0;i<3;i++) if(a[i]!==b[i]) return a[i]!<b[i]!
  return false
}
// Persist the highest verified minimum. A network error, optional follow-up
// release, or stale feed must not undo a requirement already received.
export class RequiredUpdatePolicy {
  minimumVersion?: string
  constructor(private file: string, private current: string) {
    try { const value=JSON.parse(fs.readFileSync(file,'utf8')); if(stableVersion(value.minimumVersion))this.minimumVersion=value.minimumVersion } catch { /* First launch. */ }
  }
  get required(): boolean { return !!this.minimumVersion && belowVersion(this.current,this.minimumVersion) }
  accept(release: string, minimum: unknown): void {
    if(minimum===undefined)return
    if(!stableVersion(minimum)||!stableVersion(release)||belowVersion(release,minimum))throw Error('UPDATE_POLICY_INVALID')
    if(this.minimumVersion&&!belowVersion(this.minimumVersion,minimum))return
    this.minimumVersion=minimum
    fs.mkdirSync(path.dirname(this.file),{recursive:true})
    const temporary=this.file+'.tmp'
    fs.writeFileSync(temporary,JSON.stringify({minimumVersion:minimum}))
    fs.renameSync(temporary,this.file)
  }
}
