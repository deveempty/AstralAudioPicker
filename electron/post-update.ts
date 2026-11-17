import fs from 'node:fs/promises'
import path from 'node:path'
import {preparationSteps,type PreparationState,type PreparationStep} from '../shared/post-update'
export function createPostUpdate(directory:string,version:string,isExisting:()=>Promise<boolean>,actions:Record<PreparationStep,(progress:(percent:number)=>void)=>Promise<void>>){
 let state:PreparationState={phase:'idle',completed:[],version},pending:Promise<PreparationState>|undefined
 const file=path.join(directory,'post-update.json')
 async function persist(){await fs.mkdir(directory,{recursive:true});await fs.writeFile(file+'.tmp',JSON.stringify(state));await fs.rename(file+'.tmp',file)}
 async function run(force=false){
  try{
   let previous:PreparationState|undefined
   try{previous=JSON.parse(await fs.readFile(file,'utf8'))}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}
   if(!force&&previous?.version===version&&previous.phase==='ready'){state=previous;return state}
   if(!previous&&!await isExisting()){state={phase:'ready',completed:[],version};await persist();return state}
   // Each retry re-verifies prerequisites. Individual mutations are idempotent
   // and transactional; a persisted completion never substitutes for readback.
   state={phase:'running',version,completed:[]}
   for(const step of preparationSteps){
    state={...state,phase:'running',step,percent:undefined,code:undefined};await persist()
    await actions[step](percent=>{state={...state,percent:Math.max(0,Math.min(100,percent))}})
    state={...state,completed:[...state.completed,step]};await persist()
   }
   state={...state,phase:'ready',percent:100};await persist()
  }catch(error){state={...state,phase:'error',code:error instanceof Error&&/^[A-Z][A-Z0-9_]+$/.test(error.message)?error.message:'PREPARATION_INTERRUPTED'};await persist().catch(()=>{});await fs.appendFile(path.join(directory,'failures.jsonl'),JSON.stringify({at:new Date().toISOString(),version,step:state.step,code:state.code,detail:error instanceof Error?{message:error.message,cause:error.cause}:String(error)})+'\n').catch(()=>{})}
  return state
 }
 return {status:()=>state,start:(force=false)=>{if(pending)return pending;state={...state,phase:'running'};return pending=run(force).finally(()=>{pending=undefined})}}
}
