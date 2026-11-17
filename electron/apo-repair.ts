import fs from 'node:fs'
import path from 'node:path'
import {ASTRAL_APP_DATA} from './astral-paths'
import {readApoInventory} from './apo-inventory'
import {planApoRepair,selectApoEndpoint,type ApoInventory} from './apo-repair-plan'
import {writeApoRepair} from './apo-repair-write'
export type ApoRepairProgress='apo-inspect'|'apo-repair'|'apo-readback'
export function createApoRepair(
 reconnect:<T>(operation:()=>Promise<T>)=>Promise<T>,
 dependencies={read:readApoInventory,write:writeApoRepair,pending:()=>fs.existsSync(path.join(ASTRAL_APP_DATA,'apo-repair','pending.json'))},
){
 let running=false
 const directory=path.join(ASTRAL_APP_DATA,'apo-repair')
 return async(progress:(stage:ApoRepairProgress)=>void=()=>{}):Promise<ApoInventory>=>{
  if(running)throw Error('AUDIO_PREPARATION_BUSY')
  running=true
  try{
   if(dependencies.pending())await reconnect(()=>dependencies.write([],directory))
   progress('apo-inspect')
   const before=await dependencies.read(),patches=planApoRepair(before)
   if(patches.length){progress('apo-repair');await reconnect(()=>dependencies.write(patches,directory))}
   progress('apo-readback')
   const after=await dependencies.read()
   if(planApoRepair(after).length)throw Error('APO_REPAIR_FAILED')
   for(const kind of ['legacy','v5'] as const){const old=selectApoEndpoint(before,kind),next=selectApoEndpoint(after,kind);if(old.id!==next.id||old.state!==next.state)throw Error('APO_REPAIR_CONFLICT')}
   return after
  }finally{running=false}
 }
}
