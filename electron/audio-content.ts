import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {withDownloadedAsset} from './audio-download'
export interface ContentFile {path:string;sha256:string;bytes:number}
export interface ContentManifest {id:string;archiveSha256:string;archiveBytes:number;files:ContentFile[];installerSha256:string;installerBytes:number}
const hash=(data:Buffer)=>createHash('sha256').update(data).digest('hex')
const exists=async(p:string)=>{try{await fs.access(p);return true}catch{return false}}
export function contentDestination(relative:string,roots:Record<string,string>){
 const parts=relative.split('/')
 if(parts.length<2||parts.some(p=>!p||p==='.'||p==='..'||/[\\:]/.test(p))||!roots[parts[0]])throw Error('CONTENT_UNSAFE_PATH')
 if(parts[0]==='presets'&&(!/^MW4_.*\.txt$/i.test(parts.slice(1).join('/'))||parts.length!==2))throw Error('CONTENT_UNEXPECTED_PRESET')
 if(parts[0]==='charlie'&&!['charlie/atk_spatial_engine_charlie_v1_0_0.dll','charlie/atk_spatial_engine_charlie_v1_1_0.dll'].includes(relative))throw Error('CONTENT_UNEXPECTED_PLUGIN')
 return path.join(roots[parts[0]],...parts.slice(1))
}
async function rejectLinks(file:string){
 for(let current=file;current!==path.dirname(current);current=path.dirname(current)){
  try{if((await fs.lstat(current)).isSymbolicLink())throw Error('CONTENT_LINK_TARGET')}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}
 }
}
export async function applyContentFiles(source:string,manifest:ContentManifest,roots:Record<string,string>,backup:string){
 const records:Array<{target:string;backup:string|null}>=[]
 const seen=new Set<string>()
 // Validate every file and destination before the first write.
 for(const file of manifest.files){
  const target=contentDestination(file.path,roots)
  if(seen.has(target.toLowerCase()))throw Error('CONTENT_DUPLICATE_PATH');seen.add(target.toLowerCase())
  await rejectLinks(target)
  const data=await fs.readFile(path.join(source,...file.path.split('/')))
  if(data.length!==file.bytes||hash(data)!==file.sha256)throw Error('CONTENT_HASH_MISMATCH')
 }
 await fs.mkdir(backup,{recursive:true})
 try{
  for(const file of manifest.files){
   const target=contentDestination(file.path,roots),data=await fs.readFile(path.join(source,...file.path.split('/')))
   let previous:Buffer|undefined
   try{previous=await fs.readFile(target)}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error}
   if(previous&&hash(previous)===file.sha256)continue
   const saved=previous?path.join(backup,String(records.length)):null
   if(saved)await fs.writeFile(saved,previous!)
   records.push({target,backup:saved})
   await fs.appendFile(path.join(backup,'journal.jsonl'),JSON.stringify(records[records.length-1])+'\n')
   await fs.mkdir(path.dirname(target),{recursive:true})
   const temporary=target+'.'+randomUUID()+'.tmp'
   try{await fs.writeFile(temporary,data);await fs.rename(temporary,target)}finally{await fs.rm(temporary,{force:true})}
   if(hash(await fs.readFile(target))!==file.sha256)throw Error('CONTENT_READBACK_FAILED')
  }
 }catch(error){
  let rollbackFailed=false
  for(const record of records.reverse())try{if(record.backup)await fs.copyFile(record.backup,record.target);else await fs.rm(record.target,{force:true})}catch{rollbackFailed=true}
  if(rollbackFailed)throw Error('CONTENT_ROLLBACK_INCOMPLETE')
  throw error
 }
 return records.length
}
export async function installAudioContent(resources:string,apo:string,localData:string,migrationRoot:string,onPhase?:(phase:'downloading'|'content')=>void){
 const marker=path.join(migrationRoot,'mw4-content-v1.json')
 const manifest=JSON.parse(await fs.readFile(path.join(resources,'manifest.json'),'utf8')) as ContentManifest
 if(manifest.id!=='mw4-content-v1'||!Array.isArray(manifest.files)||manifest.files.length<40)throw Error('CONTENT_INVALID_MANIFEST')
 if(await exists(marker)){
  const saved=JSON.parse(await fs.readFile(marker,'utf8'))
  if(saved.id===manifest.id&&saved.completed===true&&saved.archiveSha256===manifest.archiveSha256&&saved.layoutVersion===2)return
 }
 if(!await exists(path.join(apo,'config.txt')))throw Error('CONTENT_APO_MISSING')
 await fs.mkdir(migrationRoot,{recursive:true})
 onPhase?.('downloading')
 await withDownloadedAsset({name:'mw4-content-v1.zip',sha256:manifest.archiveSha256,bytes:manifest.archiveBytes},async(archive,workspace)=>{
  onPhase?.('content')
  const stage=path.join(workspace,'extracted');await fs.mkdir(stage)
  await promisify(execFile)('tar.exe',['-xf',archive,'-C',stage],{windowsHide:true,timeout:120000})
  const roots={presets:path.join(apo,'data','AIWV5','ArtTuneKit','MW4','V1'),charlie:path.join(process.env.ProgramFiles||'C:\\Program Files','VSTPlugins','ArtTuneKit'),measurements:path.join(localData,'measurements'),targets:path.join(localData,'targets'),'reference-eq':path.join(localData,'reference-eq')}
  const changed=await applyContentFiles(stage,manifest,roots,path.join(migrationRoot,'backups','mw4-'+Date.now()))
  await migrateV5Includes(apo, migrationRoot)
  await fs.writeFile(marker+'.tmp',JSON.stringify({id:manifest.id,archiveSha256:manifest.archiveSha256,layoutVersion:2,completed:true,changed,completedAt:new Date().toISOString()}))
  await fs.rename(marker+'.tmp',marker)
 })
}

export async function migrateV5Includes(apo:string,migrationRoot:string){
 const config=path.join(apo,'config.txt'),original=await fs.readFile(config,'utf8')
 let updated=original
 const pattern=/^(\s*#?\s*Include:\s*)(ArtTuneDB[\\/]library[\\/](?:MW4[\\/]V1|BO7[\\/]V5)[\\/][^\r\n]+\.txt)\s*$/gmi
 for(const match of original.matchAll(pattern)){
  const relative=match[2].replace(/^ArtTuneDB[\\/]library[\\/]/i,'data\\AIWV5\\ArtTuneKit\\')
  const destination=path.resolve(apo,relative)
  if(!destination.startsWith(path.resolve(apo)+path.sep))throw Error('CONTENT_UNSAFE_INCLUDE')
  if(!await exists(destination)){
   const old=path.resolve(apo,match[2]);if(!old.startsWith(path.resolve(apo)+path.sep)||!await exists(old))throw Error('CONTENT_PRESET_MISSING')
   await rejectLinks(destination);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.copyFile(old,destination)
  }
  updated=updated.replace(match[0],match[1]+relative)
 }
 if(updated!==original){
  await fs.mkdir(migrationRoot,{recursive:true});await fs.writeFile(path.join(migrationRoot,'config-before-layout-'+Date.now()+'.txt'),original)
  await fs.writeFile(config+'.astral-layout.tmp',updated);await fs.rename(config+'.astral-layout.tmp',config)
 }
}
