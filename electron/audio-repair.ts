import {readApoChain,verifyApoChain} from './apo-chain'
import type {Loudness16State} from '../shared/loudness16'
import type {AudioRepairResult} from '../shared/audio-repair'

/** Repair both cables before enabling LEQ on the verified 16-channel chain. */
export function createAudioRepair(
 loudness:{read:()=>Promise<Loudness16State>;change:(value:{enabled:boolean})=>Promise<Loudness16State>},
 record:(entry:unknown)=>Promise<void>,
 repairApo:()=>Promise<unknown>,
 readChain=readApoChain,
){
 let pending=false
 return {busy:()=>pending,async finish():Promise<AudioRepairResult>{
  if(pending)return {ok:false,code:'AUDIO_PREPARATION_BUSY'}
  pending=true
  try{
   await repairApo()
   const before=await readChain();verifyApoChain(before)
   const leq=await loudness.read()
   if(leq.deviceId.toLowerCase()!==before.deviceId.toLowerCase())throw Error('LOUDNESS_READBACK_FAILED')
   // Persist the observed settings before any write. A logging failure stops repair.
   await record({at:new Date().toISOString(),stage:'before',chain:before,loudness:leq})
   await loudness.change({enabled:true})
   const after=await readChain();verifyApoChain(after)
   const legacy=await readChain('legacy');verifyApoChain(legacy)
   if(legacy.disabled)throw Error('APO_CHAIN_UNCONFIRMED')
   const result=await loudness.read()
   if(after.deviceId.toLowerCase()!==before.deviceId.toLowerCase()||result.deviceId.toLowerCase()!==before.deviceId.toLowerCase()||!result.enabled||after.disabled||result.releaseTime!==leq.releaseTime)throw Error('LOUDNESS_READBACK_FAILED')
   await record({at:new Date().toISOString(),stage:'verified',chain:after,loudness:result})
   return {ok:true,active:after.active}
  }catch(error){
   const known=['APO_CHAIN_UNCONFIRMED','APO_ENDPOINT_UNAVAILABLE','APO_COMPONENT_UNAVAILABLE','APO_ORIGINAL_EFFECTS_UNKNOWN','APO_REPAIR_FAILED','APO_REPAIR_CONFLICT','APO_REPAIR_ROLLBACK_FAILED','APO_RESTART_FAILED','APO_REPAIR_ELEVATION_FAILED','AUDIO_PREPARATION_BUSY','LOUDNESS_READBACK_FAILED','LOUDNESS_WRITE_OR_RESTART_FAILED','LOUDNESS_RELAY_RESTART_FAILED']
   const code=error instanceof Error&&known.includes(error.message)?error.message:'PREPARATION_INTERRUPTED'
   await record({at:new Date().toISOString(),stage:'failed',code,detail:error instanceof Error?error.message:String(error),cause:error instanceof Error?error.cause:undefined}).catch(()=>{})
   return {ok:false,code}
  }finally{pending=false}
 }}
}
