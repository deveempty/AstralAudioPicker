import {safeStorage,shell} from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import http from 'node:http'
import {hasCosmicAccess,type CosmicRolePolicy} from './cosmic-delivery'
const clientId='1423104834629926992'
const redirect='http://127.0.0.1:51789/callback'
interface Credentials {accessToken:string;refreshToken:string;expiresAt:number}
interface Session {credentials:Credentials;createdAt:number}
export interface CosmicAccount {id:string;username:string}
export interface CosmicAuthOptions {
 directory:string
 policy:CosmicRolePolicy
 // Server must derive the Discord identity from the bearer, never a client-provided user ID.
 verify:(accessToken:string)=>Promise<{id:string;username:string;roles:string[]}>
}
export function createCosmicAuth(options:CosmicAuthOptions){
 const file=path.join(options.directory,'cosmic-session.encrypted');let generation=0,busy=false,cancel:(()=>void)|undefined
 const request=async(url:string,init:RequestInit={})=>{const r=await fetch(url,{...init,redirect:'error',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('DISCORD_HTTP_'+r.status);return r.json()}
 const credentials=async(body:URLSearchParams):Promise<Credentials>=>{const value=await request('https://discord.com/api/v10/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});if(typeof value.access_token!=='string'||typeof value.refresh_token!=='string'||!Number.isFinite(value.expires_in)||value.expires_in<=0)throw Error('INVALID_SESSION');return {accessToken:value.access_token,refreshToken:value.refresh_token,expiresAt:Date.now()+value.expires_in*1000}}
 const verify=async(token:string):Promise<CosmicAccount>=>{const access=await options.verify(token);if(typeof access.id!=='string'||typeof access.username!=='string'||!hasCosmicAccess(access.roles,options.policy))throw Error('ACCESS_DENIED');return {id:access.id,username:access.username}}
 const save=async(session:Session,epoch:number)=>{if(epoch!==generation)throw Error('SESSION_CANCELLED');if(!safeStorage.isEncryptionAvailable())throw Error('ENCRYPTION_UNAVAILABLE');await fs.mkdir(options.directory,{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,safeStorage.encryptString(JSON.stringify(session)),{flag:'wx'});if(epoch!==generation)throw Error('SESSION_CANCELLED');await fs.rename(temp,file)}finally{await fs.rm(temp,{force:true})}}
 const run=async<T>(work:()=>Promise<T>)=>{if(busy)throw Error('AUTH_BUSY');busy=true;try{return await work()}finally{busy=false}}
 const login=()=>run(async()=>{
  const epoch=generation,verifier=crypto.randomBytes(32).toString('base64url'),state=crypto.randomBytes(32).toString('base64url')
  const url=new URL('https://discord.com/oauth2/authorize');url.search=new URLSearchParams({client_id:clientId,redirect_uri:redirect,response_type:'code',scope:'identify guilds.members.read',state,code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString()
  return new Promise<CosmicAccount>((resolve,reject)=>{
   let finished=false,processing=false
   const finish=(error?:Error,user?:CosmicAccount)=>{if(finished)return;finished=true;clearTimeout(timer);server.close();cancel=undefined;error?reject(error):resolve(user!)}
   const server=http.createServer(async(req,res)=>{
    const callback=new URL(req.url??'/',redirect)
    if(req.method!=='GET'||callback.pathname!=='/callback'){res.writeHead(404).end();return}
    if(callback.searchParams.get('state')!==state){res.writeHead(400).end();return}
    if(processing||finished){res.writeHead(409).end();return}processing=true
    const code=callback.searchParams.get('code');if(!code){res.writeHead(400).end('Return to Astral Audio. / Vuelve a Astral Audio.');finish(Error('LOGIN_CANCELLED'));return}
    try{const token=await credentials(new URLSearchParams({client_id:clientId,grant_type:'authorization_code',code,redirect_uri:redirect,code_verifier:verifier}));const user=await verify(token.accessToken);if(finished)throw Error('SESSION_CANCELLED');await save({credentials:token,createdAt:Date.now()},epoch);res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'}).end('Connected. Return to Astral Audio. / Conectado. Vuelve a Astral Audio.');finish(undefined,user)}catch(error){res.writeHead(403).end('Return to Astral Audio. / Vuelve a Astral Audio.');finish(error instanceof Error?error:Error('LOGIN_FAILED'))}
   })
   const timer=setTimeout(()=>finish(Error('LOGIN_TIMEOUT')),300000)
   cancel=()=>finish(Error('SESSION_CANCELLED'))
   server.once('error',()=>finish(Error('CALLBACK_UNAVAILABLE')))
   server.listen(51789,'127.0.0.1',()=>void shell.openExternal(url.toString()).catch(()=>finish(Error('BROWSER_FAILED'))))
  })
 })
 const authorizedSession=()=>run(async()=>{
  const epoch=generation;if(!safeStorage.isEncryptionAvailable())throw Error('ENCRYPTION_UNAVAILABLE')
  const session=JSON.parse(safeStorage.decryptString(await fs.readFile(file))) as Session
  if(!session.credentials||!Number.isFinite(session.createdAt)||session.createdAt>Date.now()||Date.now()-session.createdAt>30*86400000)throw Error('SESSION_EXPIRED')
  if(session.credentials.expiresAt<=Date.now()+60000)session.credentials=await credentials(new URLSearchParams({client_id:clientId,grant_type:'refresh_token',refresh_token:session.credentials.refreshToken}))
  const user=await verify(session.credentials.accessToken);await save(session,epoch);return {user,token:session.credentials.accessToken}
 })
 return {login,checkSession:async()=>(await authorizedSession()).user,authorizeDownload:async()=>(await authorizedSession()).token,logout:async()=>{generation++;cancel?.();await fs.rm(file,{force:true})}}
}
