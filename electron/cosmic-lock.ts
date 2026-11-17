import fs from 'node:fs/promises'
import {randomUUID} from 'node:crypto'

export async function acquireCosmicLock(file:string){
 const token=randomUUID()
 for(let attempt=0;attempt<2;attempt++){
  try{
   const handle=await fs.open(file,'wx')
   try{await handle.writeFile(JSON.stringify({pid:process.pid,token,at:Date.now()}))}catch(error){await handle.close();await fs.rm(file,{force:true});throw error}
   return async()=>{await handle.close();try{const value=JSON.parse(await fs.readFile(file,'utf8'));if(value.token===token)await fs.unlink(file)}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}}
  }catch(error){
   if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error
   // Serialize reclaimers so none can rename a new owner's lock after a race.
   const guardFile=file+'.recovery'
   const guard=await fs.open(guardFile,'wx').catch(()=>{throw Error('COSMIC_LOCK_RECOVERY_REQUIRED')})
   try{
    let owner:{pid:number;token:string}
    try{owner=JSON.parse(await fs.readFile(file,'utf8'))}catch{throw Error('COSMIC_LOCK_RECOVERY_REQUIRED')}
    if(!Number.isInteger(owner.pid)||owner.pid<=0||typeof owner.token!=='string')throw Error('COSMIC_LOCK_RECOVERY_REQUIRED')
    try{process.kill(owner.pid,0);throw Error('COSMIC_INSTALL_BUSY')}catch(e){if((e as NodeJS.ErrnoException).code!=='ESRCH')throw Error('COSMIC_INSTALL_BUSY')}
    await fs.rename(file,file+'.abandoned-'+randomUUID())
   }finally{await guard.close();await fs.unlink(guardFile)}
  }
 }
 throw Error('COSMIC_INSTALL_BUSY')
}
