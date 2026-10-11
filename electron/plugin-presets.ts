import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import { validPluginValues, type SavedPluginProfile } from '../shared/plugin-control'
export class PresetError extends Error { constructor(readonly code: 'invalidName'|'missingPreset'|'invalidPreset'|'storage'|'busy'|'stale') { super(code) } }
export function pluginPresetDirectory() { return process.env.ASTRAL_PLUGIN_CONTROL_DIR ? path.join(process.env.ASTRAL_PLUGIN_CONTROL_DIR,'saved-profiles') : path.join(process.env.APPDATA || path.join(os.homedir(),'AppData','Roaming'),'AstralAudio','Presets','V3') }
const validName=(value: unknown): value is string => typeof value==='string' && Array.from(value.trim()).length>=1 && Array.from(value.trim()).length<=64 && !/[\x00-\x1f\x7f]/.test(value)
export class PluginPresetLibrary {
 constructor(readonly directory: string) {}
 read(id: unknown): SavedPluginProfile {
  if(typeof id!=='string'||!/^[-a-f0-9]{32,36}\.json$/i.test(id))throw new PresetError('invalidPreset')
  const file=path.join(this.directory,id)
  if(!fs.existsSync(file))throw new PresetError('missingPreset')
  if(fs.statSync(file).size>16384)throw new PresetError('invalidPreset')
  let v;try{v=JSON.parse(fs.readFileSync(file,'utf8'))}catch{throw new PresetError('invalidPreset')}
  if(!v || typeof v!=='object' || v.schema!=='astral-v3-named-preset'||v.version!==1||v.stateVersion!==3||!validName(v.name)||!validPluginValues(v.values))throw new PresetError('invalidPreset')
  return {id,name:v.name,values:v.values}
 }
 list(): SavedPluginProfile[] { if(!fs.existsSync(this.directory))return [];return fs.readdirSync(this.directory).filter(f=>f.endsWith('.json')).flatMap(id=>{try{return [this.read(id)]}catch{return []}}).sort((a,b)=>a.name.localeCompare(b.name)) }
 save(name: unknown, values: number[]): SavedPluginProfile {
  if(!validName(name))throw new PresetError('invalidName');if(!validPluginValues(values))throw new PresetError('invalidPreset');name=name.trim()
  fs.mkdirSync(this.directory,{recursive:true});const lock=path.join(this.directory,'library.lock');let fd: number
  try { if(fs.existsSync(lock)&&Date.now()-fs.statSync(lock).mtimeMs>30000)fs.unlinkSync(lock) } catch { /* Windows holds an exclusive DLL lock while saving. */ }
  try{fd=fs.openSync(lock,'wx')}catch(e){if(['EEXIST','EACCES','EPERM'].includes((e as NodeJS.ErrnoException).code||''))throw new PresetError('busy');throw e}
  try {
   const existing=this.list().find(p=>p.name.toLowerCase()===(name as string).toLowerCase());const id=existing?.id || randomUUID()+'.json';const temporary=path.join(this.directory,randomUUID()+'.tmp')
   try { const data={schema:'astral-v3-named-preset',version:1,stateVersion:3,name,updatedAt:new Date().toISOString(),values};const out=fs.openSync(temporary,'wx');try{fs.writeFileSync(out,JSON.stringify(data));fs.fsyncSync(out)}finally{fs.closeSync(out)};fs.renameSync(temporary,path.join(this.directory,id)) }finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary)}
   return {id,name:name as string,values:[...values]}
  }finally{fs.closeSync(fd);try{fs.unlinkSync(lock)}catch{/* Another DLL writer may already own the lock. */}}
 }
}
