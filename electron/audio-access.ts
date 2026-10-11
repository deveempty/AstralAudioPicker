import {audioLocalTest} from './local-test-mode'
﻿import {app} from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import {createCosmicAuth} from './cosmic-auth'
import {createAudioDevice} from './audio-device'
import {reconcileCosmicDelivery,type CosmicRelease} from './cosmic-delivery'
import {CUSTOM_OUTPUT_DLL,customOutputActive,routeCustomOutput} from './custom-output'
import type {AudioAccessStatus} from '../shared/audio-access'
const origin='https://astral-audio-worker.astraltweaks.workers.dev'
export function createAudioAccess(configFile:string){
 if(audioLocalTest){
  const localStatus:AudioAccessStatus={phase:'ready',localTest:true}
  return {status:()=>localStatus,start:()=>localStatus,login:async()=>localStatus,retry:async()=>localStatus,requireReady:async()=>{},logout:async()=>localStatus}
 }

 const directory=path.join(app.getPath('userData'),'audio-account'),device=createAudioDevice(directory)
 let status:AudioAccessStatus={phase:'signedOut'},running:Promise<AudioAccessStatus>|undefined,started=false,lastVerified=0,checking=false
 const fetchAuthorized:typeof fetch=async(input,init={})=>{
  for(let attempt=0;attempt<2;attempt++){
   const response=await fetch(input,{...init,headers:{...Object.fromEntries(new Headers(init.headers)),...await device.headers()},redirect:'error'})
   if(response.ok)return response
   const body=await response.clone().json().catch(()=>({}));const code=typeof body.code==='string'?body.code:([404,405,501].includes(response.status)||!response.headers.get('content-type')?.includes('application/json'))?'SERVICE_NOT_READY':'AUTH_UNAVAILABLE'
   if(attempt===0&&code==='DEVICE_CLOCK_SKEW'&&device.syncClock(response.headers.get('date')))continue
   throw Error(code)
  }
  throw Error('DEVICE_CLOCK_SKEW')
 }
 const auth=createCosmicAuth({directory,policy:{roles:['1406547087495135303','1558531653142450286'],mode:'any'},verify:async(token)=>{
  const r=await fetchAuthorized(origin+'/cosmic/authorize',{method:'POST',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});return r.json()
 }})
 const execute=(login:boolean)=>running??=(async()=>{
  let stage='authentication',username:string|undefined
  try{
   status={phase:'checking'};const account=await (login?auth.login():auth.checkSession());username=account.username;stage='manifest';status={phase:'analyzing',username}
   const token=await auth.authorizeDownload(),release=await (await fetchAuthorized(origin+'/cosmic/manifest',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)})).json() as CosmicRelease
   stage='installation'
   await reconcileCosmicDelivery({installDirectory:path.dirname(CUSTOM_OUTPUT_DLL),configFile,allowedOrigin:origin,release,authorize:()=>auth.authorizeDownload(),managedText:()=>'',transformConfig:text=>routeCustomOutput(text,customOutputActive(text)),fetcher:fetchAuthorized,onPhase:phase=>{stage=phase;status={phase,username:account.username}}})
   status={phase:'ready',username:account.username};lastVerified=Date.now()
  }catch(e){const raw=e instanceof Error?e.message:'AUTH_UNAVAILABLE';const code=/^[A-Z][A-Z0-9_]{1,63}$/.test(raw)?raw:((e as NodeJS.ErrnoException).code??'AUTH_UNAVAILABLE');status={phase:stage==='authentication'&&code==='ENOENT'?'signedOut':'error',code,username,stage};try{await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,'last-error.json'),JSON.stringify({at:new Date().toISOString(),stage,code}))}catch{}}

  return status
 })().finally(()=>{running=undefined})
 return {status:()=>status,start:()=>{if(!started){started=true;void execute(false)}if(status.phase==='ready'&&!checking&&Date.now()-lastVerified>300000){checking=true;void auth.checkSession().then(()=>{lastVerified=Date.now()}).catch(e=>{status={phase:'error',code:e instanceof Error?e.message:'AUTH_UNAVAILABLE'}}).finally(()=>{checking=false})}return status},login:()=>execute(true),retry:()=>execute(false),requireReady:async()=>{if(status.phase!=='ready')throw Error('LOGIN_REQUIRED');await auth.checkSession()},logout:async()=>{if(running)return status;await auth.logout();status={phase:'signedOut'};return status}}
}
