import fs from 'node:fs/promises'
import path from 'node:path'
import type {Loudness16State} from '../shared/loudness16'

export async function ensureLoudness16Enabled(directory:string,read:()=>Promise<Loudness16State>,enable:()=>Promise<Loudness16State>){
 const marker=path.join(directory,'loudness16-enabled-v1.json')
 try{if(JSON.parse(await fs.readFile(marker,'utf8')).completed)return}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT'&&!(error instanceof SyntaxError))throw error}
 const pending=marker+'.pending'
 const before=await read()
 await fs.mkdir(directory,{recursive:true})
 let retry=false
 try{await fs.access(pending);retry=true}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}
 if(!retry)await fs.writeFile(pending,JSON.stringify({before,at:new Date().toISOString()}),'utf8')
 if(!before.enabled||retry)await enable()
 const after=await read()
 if(!after.enabled||after.deviceId!==before.deviceId)throw Error('LOUDNESS_READBACK_FAILED')
 await fs.writeFile(marker+'.tmp',JSON.stringify({completed:true,deviceId:after.deviceId,at:new Date().toISOString()}),'utf8')
 await fs.rename(marker+'.tmp',marker)
 await fs.rename(pending,marker+'.backup')
}
