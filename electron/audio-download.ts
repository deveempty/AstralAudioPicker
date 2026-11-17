import https from 'node:https'
import fs from 'node:fs/promises'
import {createWriteStream} from 'node:fs'
import path from 'node:path'
import {tmpdir} from 'node:os'
import {createHash} from 'node:crypto'
import {Transform} from 'node:stream'
import {pipeline} from 'node:stream/promises'
import {AUDIO_DOWNLOAD_ORIGIN,AUDIO_DOWNLOAD_KEY} from './audio-download-config'
export interface DownloadSpec {name:string;sha256:string;bytes:number}
const tempRoot=path.join(tmpdir(),'AstralAudioPicker-downloads')
export function downloadAssetPath(spec:DownloadSpec){
 if(!['mw4-content-v1.zip','voicemeetersetup.exe'].includes(spec.name)||! /^[a-f0-9]{64}$/.test(spec.sha256)||!Number.isSafeInteger(spec.bytes)||spec.bytes<=0||spec.bytes>512*1024*1024)throw Error('DOWNLOAD_INVALID_ASSET')
 return `/picker/stable/content/${spec.sha256}/${spec.name}`
}
export async function downloadVerified(spec:DownloadSpec,destination:string,get:typeof https.get=https.get){
 const url=AUDIO_DOWNLOAD_ORIGIN+downloadAssetPath(spec)
 const digest=createHash('sha256');let bytes=0
 await fs.mkdir(path.dirname(destination),{recursive:true})
 try{
  await new Promise<void>((resolve,reject)=>{
   const request=get(url,{headers:{'X-Audio-API-Key':AUDIO_DOWNLOAD_KEY,'User-Agent':'AstralAudioPicker'}},response=>{
    if(response.statusCode!==200){response.resume();reject(Error(`DOWNLOAD_HTTP_${response.statusCode}`));return}
    if(response.headers['content-length']&&Number(response.headers['content-length'])!==spec.bytes){response.destroy();reject(Error('DOWNLOAD_SIZE_MISMATCH'));return}
    const meter=new Transform({transform(chunk:Buffer,_encoding,callback){bytes+=chunk.length;if(bytes>spec.bytes){callback(Error('DOWNLOAD_SIZE_MISMATCH'));return}digest.update(chunk);callback(null,chunk)}})
    pipeline(response,meter,createWriteStream(destination,{flags:'wx'})).then(()=>resolve(),reject)
   })
   const deadline=setTimeout(()=>request.destroy(Error('DOWNLOAD_TIMEOUT')),15*60*1000)
   request.setTimeout(30000,()=>request.destroy(Error('DOWNLOAD_TIMEOUT')))
   request.on('error',reject)
   request.on('close',()=>clearTimeout(deadline))
  })
  if(bytes!==spec.bytes||digest.digest('hex')!==spec.sha256)throw Error('DOWNLOAD_INTEGRITY_FAILED')
 }catch(error){await fs.rm(destination,{force:true});throw error}
}
// The callback owns both extraction and installation. Its private download and
// extracted staging files are removed on success, cancellation or failure.
export async function withDownloadedAsset<T>(spec:DownloadSpec,work:(file:string,workspace:string)=>Promise<T>,download=downloadVerified){
 downloadAssetPath(spec)
 await fs.mkdir(tempRoot,{recursive:true})
 const workspace=await fs.mkdtemp(path.join(tempRoot,'work-'))
 try{
  const file=path.join(workspace,spec.name)
  await download(spec,file)
  return await work(file,workspace)
 }finally{await fs.rm(workspace,{recursive:true,force:true,maxRetries:3,retryDelay:500})}
}
// Reclaim only this updater's abandoned staging directories, never Downloads
// or the shared Astral installer work directory. Run before starting new work.
export async function cleanAbandonedAudioDownloads(){
 await fs.mkdir(tempRoot,{recursive:true})
 for(const entry of await fs.readdir(tempRoot,{withFileTypes:true})){
  if(!entry.isDirectory()||!/^work-[a-zA-Z0-9]+$/.test(entry.name))continue
  const target=path.join(tempRoot,entry.name)
  if((await fs.lstat(target)).isSymbolicLink())continue
  await fs.rm(target,{recursive:true,force:true,maxRetries:3,retryDelay:500})
 }
}
