import {accessErrorCode,canRetryVerification,verificationInterval,verificationRetry} from './session-verification'
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
  return {status:()=>localStatus,start:()=>localStatus,login:async()=>localStatus,retry:async()=>localStatus,requireReady:async()=>{},communityRequest:async(_route:string,_init?:RequestInit):Promise<Response>=>{throw Error('COMMUNITY_LOGIN_REQUIRED')},logout:async()=>localStatus}
 }

 const directory=path.join(app.getPath('userData'),'audio-account'),device=createAudioDevice(directory)
 let status:AudioAccessStatus={phase:'signedOut'},running:Promise<AudioAccessStatus>|undefined,started=false,lastVerified=0,nextVerification=0,accessGeneration=0,checking=false
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
 const communityRequest=async(route:string,init:RequestInit={}):Promise<Response>=>{
  if(status.phase!=='ready')throw Error('COMMUNITY_LOGIN_REQUIRED')
  if(!route.startsWith('/community/profiles')||route.includes('://')||route.includes('..'))throw Error('INVALID')
  const token=await auth.authorizeDownload()
  return fetchAuthorized(origin+route,{...init,headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(20000)})
 }
 const execute=(login:boolean)=>running??=(async()=>{
  const epoch=++accessGeneration
  let stage='authentication',username:string|undefined
  try{
   status={phase:'checking'};const account=await (login?auth.login():auth.checkSession());username=account.username;stage='manifest';status={phase:'analyzing',username}
   const token=await auth.authorizeDownload(),release=await (await fetchAuthorized(origin+'/cosmic/manifest',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)})).json() as CosmicRelease
   stage='installation'
   await reconcileCosmicDelivery({installDirectory:path.dirname(CUSTOM_OUTPUT_DLL),configFile,allowedOrigin:origin,release,authorize:()=>auth.authorizeDownload(),managedText:()=>'',transformConfig:text=>routeCustomOutput(text,customOutputActive(text)),fetcher:fetchAuthorized,onPhase:phase=>{stage=phase;status={phase,username:account.username}}})
   if(epoch!==accessGeneration)return status
   status={phase:'ready',username:account.username,avatarUrl:account.avatarUrl};lastVerified=Date.now();nextVerification=lastVerified+verificationInterval
  }catch(e){const raw=e instanceof Error?e.message:'AUTH_UNAVAILABLE';const code=/^[A-Z][A-Z0-9_]{1,63}$/.test(raw)?raw:((e as NodeJS.ErrnoException).code??'AUTH_UNAVAILABLE');status={phase:stage==='authentication'&&code==='ENOENT'?'signedOut':'error',code,username,stage};try{await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,'last-error.json'),JSON.stringify({at:new Date().toISOString(),stage,code}))}catch{}}

  return status
 })().finally(()=>{running=undefined})
 return {communityRequest,status:()=>status,start:()=>{
  if(!started){started=true;void execute(false)}
  if(status.phase==='ready'&&!checking&&Date.now()>=nextVerification){
   checking=true;const epoch=accessGeneration
   void auth.checkSession().then(account=>{
    if(epoch!==accessGeneration||status.phase!=='ready')return
    status={...status,username:account.username,avatarUrl:account.avatarUrl}
    lastVerified=Date.now();nextVerification=lastVerified+verificationInterval
   }).catch(e=>{
    if(epoch!==accessGeneration||status.phase!=='ready')return
    const code=accessErrorCode(e),now=Date.now()
    nextVerification=now+verificationRetry
    if(!canRetryVerification(code,lastVerified,now))status={phase:'error',code,stage:'authentication'}
   }).finally(()=>{checking=false})
  }
  return status
 },login:()=>execute(true),retry:()=>execute(false),requireReady:async()=>{if(status.phase!=='ready')throw Error('LOGIN_REQUIRED');await auth.checkSession()},logout:async()=>{if(running)return status;accessGeneration++;await auth.logout();status={phase:'signedOut'};return status}}
}
