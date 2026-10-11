import { PluginPresetLibrary, pluginPresetDirectory, PresetError } from './plugin-presets'
import { builtinPluginProfiles, builtinPluginValues, isPluginEvidence, type BuiltinPluginProfile, type PluginLibraryResult } from '../shared/plugin-control'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { isPluginState, pluginParameters, standardState, type PluginInstance, type PluginResult, type PluginSnapshot, type PluginState } from '../shared/plugin-control'

class ControlError extends Error { constructor(readonly code: 'invalid' | 'busy' | 'storage' | 'missingCustom') { super(code) } }
export class PluginControlStore {
  readonly library: PluginPresetLibrary
  constructor(readonly root: string, presetDirectory = pluginPresetDirectory()) { this.library = new PluginPresetLibrary(presetDirectory) }
  private file(name: string) { return path.join(this.root, name) }
  private readState(name = 'profile.json'): PluginState {
    const filename = this.file(name)
    if (fs.statSync(filename).size > 65536) throw new ControlError('invalid')
    const value: unknown = JSON.parse(fs.readFileSync(filename, 'utf8'))
    if (!isPluginState(value)) throw new ControlError('invalid')
    return value
  }
  private write(name: string, value: unknown) {
    const temporary = this.file(`${name}.${randomUUID()}.tmp`)
    try { const fd = fs.openSync(temporary, 'wx'); try { fs.writeFileSync(fd, JSON.stringify(value)); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }; fs.renameSync(temporary, this.file(name)) }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary) }
  }
  private locked<T>(action: () => T): T {
    fs.mkdirSync(this.root, { recursive: true })
    const filename = this.file('profile.lock')
    try { if (Date.now() - fs.statSync(filename).mtimeMs > 30000) fs.unlinkSync(filename) } catch { /* absent or held by another writer */ }
    let fd: number
    try { fd = fs.openSync(filename, 'wx') } catch (e) { if ((e as NodeJS.ErrnoException).code === 'EEXIST') throw new ControlError('busy'); throw e }
    try { return action() } finally { fs.closeSync(fd); fs.unlinkSync(filename) }
  }
  private snapshot(): PluginSnapshot {
    const state = this.readState()
    const directory = this.file('instances')
    const instances: PluginInstance[] = []
    if (fs.existsSync(directory)) for (const name of fs.readdirSync(directory).filter(n => n.endsWith('.json')).slice(0, 128)) {
      try { const file = path.join(directory, name); if (fs.statSync(file).size > 8192) continue
        const entry = JSON.parse(fs.readFileSync(file, 'utf8'))
        if (entry.schema === 'astral-plugin-instance-v1' && typeof entry.instance === 'string' && Number.isFinite(entry.updatedAt) && Date.now() >= entry.updatedAt && Date.now() - entry.updatedAt < 1500 && Number.isSafeInteger(entry.receivedRevision) && Number.isSafeInteger(entry.audioRevision) && typeof entry.processing === 'boolean' && Array.isArray(entry.modules) && entry.modules.length === 3 && entry.modules.every((x: unknown) => typeof x === 'number')) instances.push({ ...entry, evidence: isPluginEvidence(entry.evidence) ? entry.evidence : undefined, audioService: entry.audioService === true, pid: Number.isSafeInteger(entry.pid) ? entry.pid : undefined })
      } catch { /* A heartbeat may disappear while the plugin closes. */ }
    }
    return { state, instances, hasCustom: state.profile === 'custom' || fs.existsSync(this.file('custom-profile.json')) }
  }
  private result(action: () => PluginSnapshot): PluginResult {
    try { return { success: true, snapshot: action() } } catch (e) { return { success: false, code: e instanceof ControlError || e instanceof PresetError ? e.code : 'storage' } }
  }
  get(): PluginResult { return this.result(() => { if (!fs.existsSync(this.file('profile.json'))) this.locked(() => { if (!fs.existsSync(this.file('profile.json'))) this.write('profile.json', standardState()) }); return this.snapshot() }) }
  patch(patch: unknown): PluginResult { return this.result(() => {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new ControlError('invalid')
    const entries = Object.entries(patch); if (!entries.length || entries.length > 50) throw new ControlError('invalid')
    const edits = entries.map(([id, value]) => { const parameter = pluginParameters.find(p => p.id === id); if (!parameter || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) throw new ControlError('invalid'); return { index: parameter.index, value } })
    this.locked(() => { const state = this.readState(); for (const edit of edits) state.values[edit.index] = edit.value; state.profile = 'custom'; state.source = 'picker'; state.revision++; this.write('profile.json', state) }); return this.snapshot()
  }) }
  private replaceValues(values: number[]): PluginSnapshot { this.locked(()=>{const current=this.readState();if(current.profile==='custom')this.write('custom-profile.json',current);this.write('profile.json',{...current,values:[...values],profile:'custom',source:'picker',revision:current.revision+1})});return this.snapshot() }
  builtin(id: unknown): PluginResult { return this.result(()=>{if(typeof id!=='string'||!builtinPluginProfiles.includes(id as BuiltinPluginProfile))throw new ControlError('invalid');return this.replaceValues(builtinPluginValues(id as BuiltinPluginProfile))}) }
  loadSaved(id: unknown): PluginResult { return this.result(()=>this.replaceValues(this.library.read(id).values)) }
  listSaved(): PluginLibraryResult {try{return {success:true,profiles:this.library.list(),directory:this.library.directory}}catch(e){return {success:false,code:e instanceof PresetError?e.code:'storage'}}}
  saveNamed(name: unknown, revision: unknown): PluginLibraryResult {try{const saved=this.locked(()=>{const state=this.readState();if(revision!==state.revision)throw new PresetError('stale');return this.library.save(name,state.values)});return {success:true,profiles:this.library.list(),directory:this.library.directory,savedId:saved.id}}catch(e){return {success:false,code:e instanceof PresetError?e.code:e instanceof ControlError&&e.code==='busy'?'busy':'storage'}}}
  select(profile: unknown): PluginResult { return this.result(() => {
    if (profile !== 'standard' && profile !== 'custom') throw new ControlError('invalid')
    this.locked(() => { const current = this.readState(); if (current.profile === 'custom') this.write('custom-profile.json', current)
      if (profile === 'custom' && !fs.existsSync(this.file('custom-profile.json'))) throw new ControlError('missingCustom')
      const next = profile === 'standard' ? standardState(current.revision + 1) : { ...this.readState('custom-profile.json'), revision: current.revision + 1, source: 'picker' }
      this.write('profile.json', next)
    }); return this.snapshot()
  }) }
}
export function pluginControlDirectory() { return process.env.ASTRAL_PLUGIN_CONTROL_DIR || path.join(process.env.ProgramData || 'C:\\ProgramData', 'AstralAudio', 'Control', 'v3') }
