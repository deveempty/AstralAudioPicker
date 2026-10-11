import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
export interface CosmicRelease { version: string; url: string; sha256: string; size: number }
export type CosmicRolePolicy = { roles: [string,string]; mode: 'all'|'any' }
export function hasCosmicAccess(actual: string[], policy: CosmicRolePolicy): boolean {
 if(!Array.isArray(actual)||!actual.every(x=>typeof x==='string')||policy.roles.length!==2||new Set(policy.roles).size!==2||!policy.roles.every(x=>/^\d{17,20}$/.test(x)))return false
 return policy.mode==='all'?policy.roles.every(x=>actual.includes(x)):policy.mode==='any'&&policy.roles.some(x=>actual.includes(x))
}
const begin='# BEGIN ASTRAL COSMIC INSTALLATION'
const end='# END ASTRAL COSMIC INSTALLATION'
export function reconcileCosmicText(original:string,managedText:string):string {
 if(!managedText.trim()||managedText.includes(begin)||managedText.includes(end)||managedText.includes('\0'))throw Error('INVALID_RECONCILIATION')
 const newline=original.includes('\r\n')?'\r\n':'\n'
 const body=managedText.replace(/\r?\n/g,newline).replace(/[\r\n]+$/,'')
 const replacement=begin+newline+body+newline+end
 const first=original.indexOf(begin),last=original.indexOf(end)
 if(first<0&&last<0)return original+(original.endsWith('\n')||!original?'':newline)+replacement+newline
 if(first<0||last<first||original.indexOf(begin,first+begin.length)>=0||original.indexOf(end,last+end.length)>=0)throw Error('AMBIGUOUS_RECONCILIATION')
 return original.slice(0,first)+replacement+original.slice(last+end.length)
}
const hash=(data:Buffer)=>createHash('sha256').update(data).digest('hex')
export interface CosmicDeliveryOptions {
 installDirectory:string
 configFile:string
 allowedOrigin:string
 release:CosmicRelease
 // Must revalidate identity and roles on the server. No renderer-supplied token.
 authorize:()=>Promise<string|null>
 managedText:(absoluteDll:string)=>string
 transformConfig?:(original:string)=>string
 onPhase?:(phase:'downloading'|'reconciling')=>void
 fetcher?:typeof fetch
}
export async function reconcileCosmicDelivery(options:CosmicDeliveryOptions):Promise<{changed:boolean;dll:string}> {
 const {release}=options;const url=new URL(release.url)
 if(url.protocol!=='https:'||url.origin!==options.allowedOrigin||url.username||url.password||!/^[a-f0-9]{64}$/i.test(release.sha256)||!Number.isSafeInteger(release.size)||release.size<64||release.size>64*1024*1024||!release.version)throw Error('INVALID_RELEASE')
 const token=await options.authorize();if(!token)throw Error('ACCESS_DENIED')
 await fs.mkdir(options.installDirectory,{recursive:true})
 const dll=path.join(options.installDirectory,'Cosmic.dll'),lock=path.join(options.installDirectory,'cosmic-install.lock')
 const handle=await fs.open(lock,'wx');const temp=dll+'.'+randomUUID()+'.download'
 let backupDll:Buffer|null=null,committed=false
 try {
  const original=await fs.readFile(options.configFile)
  if(original.includes(0))throw Error('UNSUPPORTED_CONFIG_ENCODING')
  const next=Buffer.from(options.transformConfig?options.transformConfig(original.toString('utf8')):reconcileCosmicText(original.toString('utf8'),options.managedText(dll)),'utf8')
  try{backupDll=await fs.readFile(dll)}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}
  const dllChanged=!backupDll||hash(backupDll)!==release.sha256.toLowerCase()
  if(dllChanged){
   options.onPhase?.('downloading')
   const response=await (options.fetcher??fetch)(url,{headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(60000)})
   if(!response.ok||!response.body)throw Error('DOWNLOAD_FAILED')
   const reader=response.body.getReader(),chunks:Uint8Array[]=[];let bytes=0
   try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>release.size)throw Error('INVALID_DOWNLOAD_SIZE');chunks.push(value)}}finally{await reader.cancel()}
   const data=Buffer.concat(chunks)
   if(data.length!==release.size||hash(data)!==release.sha256.toLowerCase()||data.readUInt16LE(0)!==0x5a4d)throw Error('INVALID_DOWNLOAD')
   const pe=data.readUInt32LE(0x3c);if(pe+6>data.length||data.readUInt32LE(pe)!==0x4550||data.readUInt16LE(pe+4)!==0x8664)throw Error('INVALID_DLL_ARCHITECTURE')
   const out=await fs.open(temp,'wx');try{await out.writeFile(data);await out.sync()}finally{await out.close()}
  }
  options.onPhase?.('reconciling')
  if(!(await options.authorize()))throw Error('ACCESS_DENIED')
  if(!(await fs.readFile(options.configFile)).equals(original))throw Error('CONFIG_CHANGED')
  const configChanged=!original.equals(next)
  if(!dllChanged&&!configChanged)return {changed:false,dll}
  if(configChanged){const backup=options.configFile+'.cosmic.'+randomUUID()+'.bak';await fs.writeFile(backup,original,{flag:'wx'})}
  if(dllChanged){await fs.rename(temp,dll);committed=true}
  if(configChanged){const staged=options.configFile+'.'+randomUUID()+'.tmp';try{await fs.writeFile(staged,next,{flag:'wx'});if(!(await fs.readFile(options.configFile)).equals(original))throw Error('CONFIG_CHANGED');await fs.rename(staged,options.configFile)}finally{await fs.rm(staged,{force:true})}}
  return {changed:true,dll}
 }catch(error){
  if(committed){if(backupDll){const rollback=dll+'.'+randomUUID()+'.rollback';await fs.writeFile(rollback,backupDll);await fs.rename(rollback,dll)}else await fs.rm(dll,{force:true})}
  throw error
 }finally{await fs.rm(temp,{force:true});await handle.close();await fs.rm(lock,{force:true})}
}
