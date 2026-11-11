import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
async function load(file,overrides={}){
 const source=await fs.readFile(new URL('../electron/'+file+'.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,require:name=>name==='electron'?{safeStorage:{isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s),decryptString:b=>b.toString()},shell:{openExternal:()=>{throw Error('Browser must not open')}}}:name==='./cosmic-delivery'?{hasCosmicAccess:()=>true}:require(name),Buffer,URL,URLSearchParams,AbortSignal,Error,TypeError,Date,setTimeout,clearTimeout,...overrides});
 return module.exports;
}
const {accessErrorCode,canRetryVerification}=await load('session-verification');
test('Transient failures have a bounded retry window; actual denials never get grace',()=>{
 const now=2_000_000,last=now-300_000;
 for(const code of ['AUTH_BUSY','AUTH_UNAVAILABLE','DISCORD_HTTP_429','DISCORD_HTTP_503'])assert.equal(canRetryVerification(code,last,now),true);
 for(const code of ['ACCESS_DENIED','ROLE_REQUIRED','SESSION_EXPIRED','DISCORD_HTTP_401','INVALID_SESSION','HWID_MISMATCH'])assert.equal(canRetryVerification(code,last,now),false);
 assert.equal(canRetryVerification('AUTH_UNAVAILABLE',now-900_000,now),false);
 assert.equal(canRetryVerification('AUTH_UNAVAILABLE',0,now),false);
 assert.equal(accessErrorCode(new TypeError('fetch failed')),'AUTH_UNAVAILABLE');
 assert.equal(accessErrorCode(new Error('unexpected bug')),'VERIFICATION_FAILED');
});
async function fixture(verify,fetcher){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'picker-session-test-'));
 const file=path.join(directory,'cosmic-session.encrypted');
 const seed=async expiresAt=>fs.writeFile(file,JSON.stringify({createdAt:Date.now()-1000,credentials:{accessToken:'test-old',refreshToken:'test-refresh-old',expiresAt}}));
 const {createCosmicAuth}=await load('cosmic-auth',{fetch:fetcher??(()=>{throw Error('Unexpected token request')})});
 return {file,seed,auth:createCosmicAuth({directory,policy:{roles:[],mode:'any'},verify}),cleanup:()=>fs.rm(directory,{recursive:true,force:true})};
}
test('Concurrent checks and Community authorization share one verification',async()=>{
 let finish,started;const gate=new Promise(r=>finish=r),entered=new Promise(r=>started=r);let calls=0;
 const f=await fixture(async()=>{calls++;started();await gate;return {id:'123',username:'test',roles:[]}});
 try{await f.seed(Date.now()+3600000);const a=f.auth.checkSession(),b=f.auth.authorizeDownload();await entered;finish();assert.equal((await a).username,'test');assert.equal(await b,'test-old');assert.equal(calls,1)}finally{await f.cleanup()}
});
test('Rotated refresh credentials survive a later verification failure without browser login',async()=>{
 let tokens=0,checks=0;
 const f=await fixture(async token=>{checks++;assert.equal(token,'test-new');if(checks===1)throw Error('AUTH_UNAVAILABLE');return {id:'123',username:'test',roles:[]}},async()=>{tokens++;return {ok:true,json:async()=>({access_token:'test-new',refresh_token:'test-refresh-new',expires_in:3600})}});
 try{
  await f.seed(Date.now()-1000);await assert.rejects(f.auth.checkSession(),/AUTH_UNAVAILABLE/);
  const saved=JSON.parse(await fs.readFile(f.file,'utf8'));assert.equal(saved.credentials.refreshToken,'test-refresh-new');
  assert.equal((await f.auth.checkSession()).username,'test');assert.equal(tokens,1);
 }finally{await f.cleanup()}
});
test('Logout cancels an in-flight check and cannot recreate its session',async()=>{
 let finish,started;const gate=new Promise(r=>finish=r),entered=new Promise(r=>started=r);
 const f=await fixture(async()=>{started();await gate;return {id:'123',username:'test',roles:[]}});
 try{await f.seed(Date.now()+3600000);const check=f.auth.checkSession();await entered;await f.auth.logout();finish();await assert.rejects(check,/SESSION_CANCELLED/);await assert.rejects(fs.stat(f.file),{code:'ENOENT'})}finally{await f.cleanup()}
});
