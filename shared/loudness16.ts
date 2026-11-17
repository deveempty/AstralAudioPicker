export interface Loudness16State {deviceId:string;enabled:boolean;releaseTime:number}
export type Loudness16Change={enabled:boolean}|{releaseTime:number}

export interface LoudnessEqSettings { enabled:boolean; releaseTime:number }
export function validLoudnessEqSettings(value:unknown):value is LoudnessEqSettings {
 if(!value||typeof value!=='object')return false
 const s=value as LoudnessEqSettings
 return typeof s.enabled==='boolean'&&[0,20,40,60,80,100].includes(s.releaseTime)&&Object.keys(s).every(k=>k==='enabled'||k==='releaseTime')
}
