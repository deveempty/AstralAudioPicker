// Versioned contract for Lirio EQ v3 REVAMP 07. Indices match stateVersion 3.
export const pluginParameters = [
  {
    "id": "LEQ",
    "index": 0,
    "unit": "",
    "min": 0,
    "max": 1,
    "initial": 1,
    "page": 3,
    "negative": false,
    "toggle": true,
    "curve": "linear"
  },
  {
    "id": "FStep",
    "index": 1,
    "unit": "",
    "min": 0,
    "max": 1,
    "initial": 1,
    "page": 3,
    "negative": false,
    "toggle": true,
    "curve": "linear"
  },
  {
    "id": "LUFS",
    "index": 2,
    "unit": "",
    "min": 0,
    "max": 1,
    "initial": 1,
    "page": 3,
    "negative": false,
    "toggle": true,
    "curve": "linear"
  },
  {
    "id": "Binaural",
    "index": 3,
    "unit": "",
    "min": 0,
    "max": 1,
    "initial": 0,
    "page": 2,
    "negative": false,
    "toggle": true,
    "curve": "linear"
  },
  {
    "id": "OwnCut",
    "index": 4,
    "unit": "dB",
    "min": 0,
    "max": 20,
    "initial": 1,
    "page": 0,
    "negative": true,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "StepBoost",
    "index": 5,
    "unit": "dB",
    "min": 0,
    "max": 24,
    "initial": 0.5,
    "page": 0,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "Explosion",
    "index": 6,
    "unit": "dB",
    "min": 0,
    "max": 15,
    "initial": 1,
    "page": 0,
    "negative": true,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "Streak",
    "index": 7,
    "unit": "dB",
    "min": 0,
    "max": 30,
    "initial": 0.6666666865348816,
    "page": 0,
    "negative": true,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "Parachute",
    "index": 8,
    "unit": "dB",
    "min": 0,
    "max": 12,
    "initial": 0.6666666865348816,
    "page": 0,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "Ambient",
    "index": 9,
    "unit": "%",
    "min": 0,
    "max": 100,
    "initial": 0.5,
    "page": 0,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "Speed",
    "index": 10,
    "unit": "ms",
    "min": 20,
    "max": 500,
    "initial": 0.0625,
    "page": 2,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "Ceiling",
    "index": 11,
    "unit": "dB",
    "min": -30,
    "max": 0,
    "initial": 0.800000011920929,
    "page": 2,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "LfeHz",
    "index": 12,
    "unit": "Hz",
    "min": 20,
    "max": 250,
    "initial": 0.21739129722118378,
    "page": 2,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "Sens",
    "index": 13,
    "unit": "%",
    "min": 0,
    "max": 100,
    "initial": 0.38999998569488525,
    "page": 1,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "DetLow",
    "index": 14,
    "unit": "Hz",
    "min": 0,
    "max": 2000,
    "initial": 0.09449999779462814,
    "page": 1,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "DetHigh",
    "index": 15,
    "unit": "Hz",
    "min": 200,
    "max": 8200,
    "initial": 0.25,
    "page": 1,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "Attack",
    "index": 16,
    "unit": "ms",
    "min": 0.5,
    "max": 50,
    "initial": 0.05050504952669144,
    "page": 1,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "Release",
    "index": 17,
    "unit": "ms",
    "min": 5,
    "max": 500,
    "initial": 0.21212121844291687,
    "page": 1,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "LowBoost",
    "index": 18,
    "unit": "dB",
    "min": -3,
    "max": 21,
    "initial": 0.4166666567325592,
    "page": 1,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "HighBoost",
    "index": 19,
    "unit": "dB",
    "min": -3,
    "max": 21,
    "initial": 0.5833333134651184,
    "page": 1,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "Mix",
    "index": 20,
    "unit": "%",
    "min": 0,
    "max": 100,
    "initial": 1,
    "page": 1,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "LufsTarget",
    "index": 21,
    "unit": "LUFS",
    "min": 0,
    "max": -30,
    "initial": 0.4000000059604645,
    "page": 2,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "LufsCeil",
    "index": 22,
    "unit": "dBFS",
    "min": -2,
    "max": -30,
    "initial": 0.18000000715255737,
    "page": 2,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "FrontCut",
    "index": 23,
    "unit": "%",
    "min": 0,
    "max": 100,
    "initial": 0.5,
    "page": 2,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "EnvTame",
    "index": 24,
    "unit": "%",
    "min": 0,
    "max": 100,
    "initial": 0,
    "page": 2,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "OutGain",
    "index": 25,
    "unit": "dB",
    "min": -24,
    "max": 24,
    "initial": 0.625,
    "page": 3,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "FpDuck",
    "index": 26,
    "unit": "dB",
    "min": 0,
    "max": 24,
    "initial": 0,
    "page": 3,
    "negative": true,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "FpLevel",
    "index": 27,
    "unit": "dBFS",
    "min": -40,
    "max": 0,
    "initial": 0.550000011920929,
    "page": 3,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "EnemyBoost",
    "index": 28,
    "unit": "dB",
    "min": 0,
    "max": 12,
    "initial": 0,
    "page": 3,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "Space",
    "index": 29,
    "unit": "%",
    "min": 0,
    "max": 100,
    "initial": 1,
    "page": 3,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "BaseOn",
    "index": 30,
    "unit": "",
    "min": 0,
    "max": 1,
    "initial": 1,
    "page": 3,
    "negative": false,
    "toggle": true,
    "curve": "linear"
  },
  {
    "id": "GunOn",
    "index": 31,
    "unit": "",
    "min": 0,
    "max": 1,
    "initial": 0,
    "page": 4,
    "negative": false,
    "toggle": true,
    "curve": "linear"
  },
  {
    "id": "GunVol",
    "index": 32,
    "unit": "%",
    "min": 0,
    "max": 100,
    "initial": 0.18,
    "page": 4,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "GunSens",
    "index": 33,
    "unit": "%",
    "min": 0,
    "max": 100,
    "initial": 0.62,
    "page": 4,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "GunRel",
    "index": 34,
    "unit": "ms",
    "min": 42,
    "max": 190,
    "initial": 0.54,
    "page": 4,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "GunAI",
    "index": 35,
    "unit": "%",
    "min": 0,
    "max": 100,
    "initial": 0.72,
    "page": 4,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "AmbOn",
    "index": 36,
    "unit": "",
    "min": 0,
    "max": 1,
    "initial": 0,
    "page": 5,
    "negative": false,
    "toggle": true,
    "curve": "linear"
  },
  {
    "id": "AmbDist",
    "index": 37,
    "unit": "%",
    "min": 0,
    "max": 100,
    "initial": 1,
    "page": 5,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "AmbGuard",
    "index": 38,
    "unit": "dB",
    "min": 0,
    "max": 6,
    "initial": 0.5,
    "page": 5,
    "negative": true,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "AmbLow",
    "index": 39,
    "unit": "Hz",
    "min": 20,
    "max": 5000,
    "initial": 0.2269,
    "page": 5,
    "negative": false,
    "toggle": false,
    "curve": "log"
  },
  {
    "id": "AmbHigh",
    "index": 40,
    "unit": "Hz",
    "min": 120,
    "max": 20000,
    "initial": 0.5293,
    "page": 5,
    "negative": false,
    "toggle": false,
    "curve": "log"
  },
  {
    "id": "AmbBand",
    "index": 41,
    "unit": "%",
    "min": 0,
    "max": 100,
    "initial": 1,
    "page": 5,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "AmbRel",
    "index": 42,
    "unit": "ms",
    "min": 20,
    "max": 500,
    "initial": 0,
    "page": 5,
    "negative": false,
    "toggle": false,
    "curve": "log"
  },
  {
    "id": "CompOn",
    "index": 43,
    "unit": "",
    "min": 0,
    "max": 1,
    "initial": 0,
    "page": 6,
    "negative": false,
    "toggle": true,
    "curve": "linear"
  },
  {
    "id": "CompAmt",
    "index": 44,
    "unit": "%",
    "min": 0,
    "max": 100,
    "initial": 1,
    "page": 6,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "CompTgt",
    "index": 45,
    "unit": "dB",
    "min": -30,
    "max": -12,
    "initial": 0.388889,
    "page": 6,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "CompRel",
    "index": 46,
    "unit": "ms",
    "min": 20,
    "max": 500,
    "initial": 0,
    "page": 6,
    "negative": false,
    "toggle": false,
    "curve": "log"
  },
  {
    "id": "CompSC",
    "index": 47,
    "unit": "%",
    "min": 0,
    "max": 100,
    "initial": 0,
    "page": 6,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "CompDet",
    "index": 48,
    "unit": "ms",
    "min": 10,
    "max": 250,
    "initial": 0.458333,
    "page": 6,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  },
  {
    "id": "CompLim",
    "index": 49,
    "unit": "ms",
    "min": 5,
    "max": 160,
    "initial": 0.483871,
    "page": 6,
    "negative": false,
    "toggle": false,
    "curve": "linear"
  }
] as const
export const standardValues: readonly number[] = [1,1,1,0,1,0.5,1,0.6666666865348816,0.6666666865348816,0.8,0.0625,0.800000011920929,0.21739129722118378,0.45,0.09449999779462814,0.25,0.05050504952669144,0.21212121844291687,0.375,0.20833333333333334,1,0.4000000059604645,0.18000000715255737,0.5,0,0.5,0,0.550000011920929,0.16666666666666666,1,1,1,0.18,0.62,0.54,0.72,1,1,0.5,0.2269,0.5293,1,0,0,1,0.388889,0,0,0.458333,0.483871]
export type PluginParameterId = typeof pluginParameters[number]['id']
export type PluginProfile = 'standard' | 'custom'
export interface PluginState { schema: 'astral-plugin-v3'; stateVersion: 3; standardVersion: 1; revision: number; profile: PluginProfile; values: number[]; source: string }
export interface PluginInstance { instance: string; updatedAt: number; receivedRevision: number; audioRevision: number; processing: boolean; modules: number[]; pid?: number; audioService?: boolean; evidence?: PluginEvidence }
export interface PluginSnapshot { state: PluginState; instances: PluginInstance[]; hasCustom: boolean }
export type PluginResult = { success: true; snapshot: PluginSnapshot } | { success: false; code: 'invalid' | 'busy' | 'storage' | 'missingCustom' | 'invalidName' | 'missingPreset' | 'invalidPreset' | 'stale' }
export function isPluginState(value: unknown): value is PluginState {
 if (!value || typeof value !== 'object') return false
 const s = value as PluginState
 return s.schema === 'astral-plugin-v3' && s.stateVersion === 3 && s.standardVersion === 1 && Number.isSafeInteger(s.revision) && s.revision >= 0 && s.revision < 9007199254740000 && (s.profile === 'standard' || s.profile === 'custom') && Array.isArray(s.values) && s.values.length === 50 && s.values.every(x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1)
}
export function standardState(revision = 0): PluginState { return { schema: 'astral-plugin-v3', stateVersion: 3, standardVersion: 1, revision, profile: 'standard', values: [...standardValues], source: 'picker' } }
export function physicalValue(index: number, normalized: number): number { const p = pluginParameters[index]; const v = p.curve === 'log' ? p.min * Math.pow(p.max / p.min, normalized) : p.min + (p.max - p.min) * normalized; return p.negative ? -v : v }

export interface PluginEvidence { hash: number; blocks: number; state: 0 | 1 | 2; input: number; output: number; delta: number[] }
export const builtinPluginProfiles = ['default', 'natural', 'focus', 'quiet', 'clean', 'discreet', 'soft'] as const
export type BuiltinPluginProfile = typeof builtinPluginProfiles[number]
export interface SavedPluginProfile { id: string; name: string; values: number[] }
export type PluginLibraryResult = { success: true; profiles: SavedPluginProfile[]; directory: string; savedId?: string } | { success: false; code: 'invalidName' | 'missingPreset' | 'invalidPreset' | 'storage' | 'busy' | 'stale' }
export function validPluginValues(v: unknown): v is number[] { return Array.isArray(v) && v.length === 50 && v.every(x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1) }
export function builtinPluginValues(id: BuiltinPluginProfile): number[] {
 const values = pluginParameters.map(p => Math.fround(p.initial))
 if (id === 'default') return values
 const set = (index: number, physical: number) => { const p = pluginParameters[index]; const value = p.negative ? -physical : physical; values[index] = Math.fround((value - p.min) / (p.max - p.min)) }
 set(9,80); set(13,45); set(18,6); set(19,2); set(25,0); set(28,2); values[31]=values[36]=1; values[43]=0
 if (id === 'natural') { set(5,12); set(32,35); set(38,-2) }
 if (id === 'focus') { set(5,18); set(18,7); set(28,3); set(32,18); set(38,-3.5) }
 if (id === 'quiet') { set(5,16); set(9,95); set(18,7); set(19,0); set(21,-14); set(28,2); set(32,15); set(38,-4.5) }
 if (id === 'clean') { set(5,22); set(9,100); set(18,8); set(19,1); set(21,-13); set(28,4); set(32,12); set(38,-5.5) }
 if (id === 'discreet') { set(5,22); set(7,-25); set(9,90); set(18,7); set(19,0); set(23,15); set(26,-6); set(27,-22); set(28,3); set(32,3); set(34,145); set(38,-4) }
 if (id === 'soft') { set(5,20); set(9,95); set(18,6); set(19,-3); set(21,-14); set(27,-22); set(28,3); set(32,10); set(38,-4.5) }
 return values
}
export function samePluginValues(a: readonly number[], b: readonly number[]) { return a.length === b.length && a.every((v,i) => Math.abs(Math.fround(v)-Math.fround(b[i])) < 1e-7) }
export function pluginFingerprint(values: readonly number[]): number { let h=2166136261; const bytes=new DataView(new ArrayBuffer(4)); for (const v of values) { bytes.setFloat32(0,v,true); h=Math.imul((h^bytes.getUint32(0,true))>>>0,16777619)>>>0 } return h }
export function isPluginEvidence(value: unknown): value is PluginEvidence {
 if (!value || typeof value !== 'object') return false
 const e=value as PluginEvidence
 return Number.isInteger(e.hash) && e.hash>=0 && e.hash<=0xffffffff && Number.isSafeInteger(e.blocks) && e.blocks>=0 && [0,1,2].includes(e.state) && [e.input,e.output].every(x=>typeof x==='number' && Number.isFinite(x) && x>=0) && Array.isArray(e.delta) && e.delta.length===3 && e.delta.every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0)
}
