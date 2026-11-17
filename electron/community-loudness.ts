import {validLoudnessEqSettings,type LoudnessEqSettings,type Loudness16State,type Loudness16Change} from '../shared/loudness16'

export interface CommunityLoudness {
  read:()=>Promise<Loudness16State>
  change:(change:Loudness16Change)=>Promise<Loudness16State>
  changed?:()=>void
  verifyActive?:(deviceId:string)=>Promise<void>
}
export const sameLoudness = (a:LoudnessEqSettings,b:LoudnessEqSettings) => a.enabled===b.enabled && a.releaseTime===b.releaseTime
export async function readCommunityLoudness(service?:CommunityLoudness):Promise<LoudnessEqSettings> {
  try {
    if(!service)throw Error('unavailable')
    const state=await service.read()
    const settings={enabled:state.enabled,releaseTime:state.releaseTime}
    if(!validLoudnessEqSettings(settings))throw Error('invalid')
    return settings
  } catch {throw Error('COMMUNITY_LOUDNESS_READ_FAILED')}
}
/** Only the existing 16ch adapter receives writes. No device identity travels in profiles. */
export async function applyCommunityLoudness(service:CommunityLoudness|undefined,target:LoudnessEqSettings) {
  if(!service)throw Error('COMMUNITY_LOUDNESS_APPLY_FAILED')
  let before:Loudness16State
  try {
    before=await service.read()
    if(!validLoudnessEqSettings({enabled:before.enabled,releaseTime:before.releaseTime}))throw Error('invalid')
  } catch {throw Error('COMMUNITY_LOUDNESS_READ_FAILED')}
  const write=async(settings:LoudnessEqSettings)=>{
    let state=await service.read()
    if(state.deviceId!==before.deviceId)throw Error('endpoint changed')
    if(state.releaseTime!==settings.releaseTime)state=await service.change({releaseTime:settings.releaseTime})
    if(state.deviceId!==before.deviceId)throw Error('endpoint changed')
    if(state.enabled!==settings.enabled)await service.change({enabled:settings.enabled})
    state=await service.read()
    if(state.deviceId!==before.deviceId||!sameLoudness(state,settings))throw Error('readback failed')
  }
  const restore=async()=>{try{await write(before)}catch{throw Error('COMMUNITY_LOUDNESS_RESTORE_FAILED')}finally{service.changed?.()}}
  try {await write(target);if(target.enabled)await service.verifyActive?.(before.deviceId)}
  catch {await restore();throw Error('COMMUNITY_LOUDNESS_APPLY_FAILED')}
  finally {service.changed?.()}
  return {before:{enabled:before.enabled,releaseTime:before.releaseTime},restore}
}
