import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';
import ts from 'typescript';
import { communityRequest, validPayload } from '../cloudflare-community/community.mjs';

const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'astral-community-tests-'));
for(const file of ['src/community-library','shared/plugin-control','shared/community','electron/plugin-presets','electron/plugin-control','electron/community']){
  const dest=path.join(scratch,file+'.cjs');fs.mkdirSync(path.dirname(dest),{recursive:true});
  let output=ts.transpileModule(fs.readFileSync(new URL('../'+file+'.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
  output=output.replace(/require\("(\.[^"]+)"\)/g,'require("$1.cjs")');fs.writeFileSync(dest,output);
}
const require=createRequire(import.meta.url);
const {PluginControlStore}=require(path.join(scratch,'electron/plugin-control.cjs'));
const {savedCommunityLibrary}=require(path.join(scratch,'src/community-library.cjs'));
const {createCommunity}=require(path.join(scratch,'electron/community.cjs'));
const {validCommunityPayload}=require(path.join(scratch,'shared/community.cjs'));
const {standardValues,pluginFingerprint}=require(path.join(scratch,'shared/plugin-control.cjs'));
test.after(()=>fs.rmSync(scratch,{recursive:true,force:true}));

function fixture(){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync(new URL('../cloudflare-community/migration.sql',import.meta.url),'utf8'));
  sqlite.exec(fs.readFileSync(new URL('../cloudflare-community/0002_applications.sql',import.meta.url),'utf8'));
  const db={prepare(sql){
    return {bind(...args){
      return {
        async first(){return sqlite.prepare(sql).get(...args)??null},
        async all(){return {results:sqlite.prepare(sql).all(...args)}},
        async run(){return sqlite.prepare(sql).run(...args)}
      };
    }};
  }};
  const objects=new Map();const env={COMMUNITY_DB:db,AUDIO_BUCKET:{async put(key,value){objects.set(key,value)},async get(key){const value=objects.get(key);return value===undefined?null:{size:Buffer.byteLength(value),text:async()=>value}}},ASTRAL_BOT:{async fetch(_url,init){const token=init.headers.get('Authorization');return token==='Bearer alice'||token==='Bearer bob'?Response.json({id:token.endsWith('alice')?'123456789012345678':'223456789012345678',username:token.slice(7)}):Response.json({code:'ACCESS_DENIED'},{status:403})}}};
  const call=(route='',method='GET',body,who='alice')=>communityRequest(new Request('https://test/community/profiles'+route,{method,headers:{Authorization:'Bearer '+who,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),env);
  return {sqlite,objects,env,call};
}
const payload=()=>({schema:'astral-community-cosmic',version:1,stateVersion:3,values:[...standardValues]});
const publication=()=>({requestId:randomUUID(),name:'Clear steps',headphones:'Test headphones',game:'Warzone',focus:'focus',payload:payload()});

test('Profiles selector reads all saved Community pages, deduplicates and excludes unsaved items',async()=>{
  const calls=[];
  const profiles=await savedCommunityLibrary(async query=>{
    calls.push(query);
    return {success:true,data:query.page===0?{profiles:[{id:'a',saved:true},{id:'b',saved:true}],more:true}:{profiles:[{id:'b',saved:true},{id:'c',saved:true},{id:'d',saved:false}],more:false}};
  },()=>false);
  assert.deepEqual(profiles.map(p=>p.id),['a','b','c']);
  assert.deepEqual(calls.map(q=>q.page),[0,1]);
  assert.ok(calls.every(q=>q.tab==='saved'&&q.search===''&&q.game===''));
});
test('Saved Community load cancellation stops pagination and errors are not treated as empty libraries',async()=>{
  let cancelled=false,calls=0;
  const result=await savedCommunityLibrary(async()=>{calls++;cancelled=true;return {success:true,data:{profiles:[],more:true}}},()=>cancelled);
  assert.deepEqual(result,[]);assert.equal(calls,1);
  await assert.rejects(()=>savedCommunityLibrary(async()=>({success:false,code:'COMMUNITY_LOGIN_REQUIRED'}),()=>false),/COMMUNITY_LOGIN_REQUIRED/);
});

test('Worker requires verified identity and configured services',async()=>{
  const f=fixture();assert.equal((await f.call('','GET',undefined,'invalid')).status,403);
  assert.equal((await communityRequest(new Request('https://test/community/profiles'),{})).status,503);f.sqlite.close();
});
test('Publish, immutable retry, private payload, favorites, reports and owner-only removal',async()=>{
  const f=fixture(),pub=publication();pub.owner='forged';pub.author='forged';
  assert.equal((await f.call('','POST',pub)).status,201);
  assert.equal((await f.call('','POST',pub)).status,200);
  assert.equal(f.objects.size,1);
  assert.equal((await f.call('','POST',{...pub,name:'Changed'})).status,409);
  assert.equal((await f.call('','POST',pub,'bob')).status,409);
  const list=await (await f.call()).json();assert.equal(list.profiles[0].author,'alice');assert.equal(list.profiles[0].owned,true);assert.equal(list.profiles[0].saved,false);assert.equal('object_key' in list.profiles[0],false);
  const downloaded=await(await f.call('/'+pub.requestId)).json();assert.deepEqual(downloaded.payload,payload());
  assert.equal(downloaded.sha256,createHash('sha256').update(JSON.stringify(payload())).digest('hex'));
  assert.equal((await f.call('/'+pub.requestId+'/favorite','PUT',undefined,'bob')).status,200);
  assert.equal((await(await f.call('?tab=saved','GET',undefined,'bob')).json()).profiles.length,1);
  assert.equal((await(await f.call('?tab=saved')).json()).profiles.length,0);
  await f.call('/'+pub.requestId+'/report','POST',{reason:'Review this'},'bob');assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM community_reports').get().n,1);
  assert.equal((await f.call('/'+pub.requestId,'DELETE',undefined,'bob')).status,403);
  assert.equal((await f.call('/'+pub.requestId,'DELETE')).status,200);
  assert.equal((await f.call('/'+pub.requestId)).status,404);
  assert.equal((await(await f.call()).json()).profiles.length,0);f.sqlite.close();
});
test('Each owner has five publication slots, including concurrent requests; removal frees a slot',async()=>{
  const f=fixture();
  const publications=Array.from({length:8},publication);
  const results=await Promise.all(publications.map(pub=>f.call('','POST',pub)));
  assert.equal(results.filter(r=>r.status===201).length,5);
  for(const response of results.filter(r=>r.status!==201)){
    assert.equal(response.status,409);assert.equal((await response.json()).code,'PROFILE_LIMIT_REACHED');
  }
  const list=await(await f.call('?tab=mine')).json();assert.equal(list.profiles.length,5);
  const accepted=publications.find(pub=>pub.requestId===list.profiles[0].id);
  assert.equal((await f.call('','POST',accepted)).status,200);
  const objectCount=f.objects.size;
  assert.equal((await(await f.call('','POST',publication())).json()).code,'PROFILE_LIMIT_REACHED');
  assert.equal(f.objects.size,objectCount);
  assert.equal((await f.call('','POST',publication(),'bob')).status,201);
  assert.equal((await f.call('/'+accepted.requestId,'DELETE')).status,200);
  assert.equal((await f.call('','POST',publication())).status,201);
  assert.equal((await(await f.call('?tab=mine')).json()).profiles.length,5);
  f.sqlite.close();
});

test('Application receipts count successful app reports, not downloads or favorites, and deduplicate retries',async()=>{
  const f=fixture(),pub=publication();await f.call('','POST',pub);
  await f.call('/'+pub.requestId);await f.call('/'+pub.requestId+'/favorite','PUT');
  assert.equal((await(await f.call()).json()).profiles[0].applications,0);
  const receipt={requestId:randomUUID()},route='/'+pub.requestId+'/applied';
  assert.equal((await(await f.call(route,'POST',receipt)).json()).applications,1);
  assert.equal((await(await f.call(route,'POST',receipt)).json()).applications,1);
  assert.equal((await(await f.call(route,'POST',{requestId:randomUUID()},'bob')).json()).applications,2);
  assert.equal((await(await f.call()).json()).profiles[0].applications,2);
  assert.equal((await f.call(route,'POST',{})).status,400);
  assert.equal((await f.call(route,'POST',receipt,'invalid')).status,403);
  f.sqlite.close();
});

test('Malformed, oversized, out-of-range and incompatible profiles cannot be published',async()=>{
  const f=fixture();
  for(const changed of [{payload:{...payload(),stateVersion:2}},{payload:{...payload(),values:[1]}},{payload:{...payload(),values:Array(50).fill(1.1)}},{name:' '},{notes:'x'.repeat(20000)},{game:'Unknown'}])assert.equal((await f.call('','POST',{...publication(),...changed})).status,400);
  assert.equal(f.objects.size,0);
  for(const values of [null,[],Array(50).fill(-1),Array(50).fill(NaN),Array(50).fill(Infinity),Array(50).fill(0),[...standardValues]])assert.equal(validPayload({...payload(),values}),validCommunityPayload({...payload(),values}));
  assert.equal((await f.call('?page=-1')).status,400);assert.equal((await f.call('?tab=admin')).status,400);f.sqlite.close();
});
test('Damaged R2 data is never served and write quotas are enforced',async()=>{
  const f=fixture(),pub=publication();await f.call('','POST',pub);const key=[...f.objects.keys()][0];f.objects.set(key,'{}');assert.equal((await f.call('/'+pub.requestId)).status,503);
  f.sqlite.prepare('UPDATE community_limits SET count=120 WHERE action=?').run('write');assert.equal((await f.call('','POST',publication())).status,429);f.sqlite.close();
});
test('Catalog search, game filter, pagination and mine are isolated',async()=>{
  const f=fixture();
  for(let i=0;i<26;i++)f.sqlite.prepare('INSERT INTO community_profiles(id,owner,author,name,game,headphones,focus,notes,object_key,sha256,request_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),'123456789012345678','alice','Profile '+i,i===0?'Valorant':'Warzone','Headphones','focus','Notes','key','hash','request',new Date().toISOString());
  const first=await(await f.call()).json(),second=await(await f.call('?page=1')).json();assert.equal(first.profiles.length,24);assert.equal(first.more,true);assert.equal(second.profiles.length,2);assert.equal(second.more,false);
  assert.equal((await(await f.call('?game=Valorant')).json()).profiles.length,1);assert.equal((await(await f.call('?search=Profile%2025')).json()).profiles.length,1);assert.equal((await(await f.call('?tab=mine','GET',undefined,'bob')).json()).profiles.length,0);f.sqlite.close();
});
test('Catalog ranks applications before recency, including filtered and paginated results',async()=>{
  const f=fixture(),ids=[];
  for(let i=0;i<26;i++){
    const id=randomUUID();ids.push(id);
    f.sqlite.prepare('INSERT INTO community_profiles(id,owner,author,name,game,headphones,focus,notes,object_key,sha256,request_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,'123456789012345678','alice','Rank '+i,'Warzone','Headphones','focus','','key','hash','request',new Date(1700000000000+i*1000).toISOString());
    for(let j=0;j<26-i;j++)f.sqlite.prepare('INSERT INTO community_applications(user_id,request_id,profile_id) VALUES(?,?,?)').run('123456789012345678',randomUUID(),id);
    f.sqlite.prepare('INSERT INTO community_favorites(user_id,profile_id) VALUES(?,?)').run('123456789012345678',id);
  }
  for(const tab of ['explore','saved','mine']){
    const first=await(await f.call('?tab='+tab+'&game=Warzone&search=Rank')).json();
    const second=await(await f.call('?tab='+tab+'&page=1')).json();
    assert.deepEqual([...first.profiles,...second.profiles].map(p=>p.id),ids);
    assert.equal(first.profiles[0].applications,26);assert.equal(first.more,true);assert.equal(second.more,false);
  }
  f.sqlite.close();
});

test('Apply uses only managed state, rejects stale edits and undo never overwrites newer changes',()=>{
  const dir=path.join(scratch,randomUUID()),store=new PluginControlStore(dir,path.join(dir,'library'));
  const initial=store.get();assert.equal(initial.success,true);const next=[...standardValues];next[5]=.9;
  assert.equal(store.applyCommunity(next,initial.snapshot.state.revision).success,true);
  assert.equal(fs.existsSync(path.join(dir,'library')),false);
  assert.deepEqual(fs.readdirSync(dir).sort(),['community-undo.json','profile.json']);
  assert.equal(store.undoCommunity().success,true);assert.deepEqual(store.get().snapshot.state.values,initial.snapshot.state.values);
  assert.equal(store.undoCommunity().code,'stale');assert.equal(store.applyCommunity(next,0).code,'stale');
  const current=store.get().snapshot;store.applyCommunity(next,current.state.revision);store.patch({[require(path.join(scratch,'shared/plugin-control.cjs')).pluginParameters[5].id]:.8});assert.equal(store.undoCommunity().code,'stale');
  assert.equal(store.applyCommunity(Array(50).fill(2),store.get().snapshot.state.revision).code,'invalid');
});
test('Electron downloads into memory, validates integrity, activates Cosmic and waits for real evidence',async()=>{
  const f=fixture(),pub=publication();await f.call('','POST',pub);
  const dir=path.join(scratch,randomUUID()),store=new PluginControlStore(dir,path.join(dir,'library'));store.get();
  let active=false,activations=0;const actualGet=store.get.bind(store);
  store.get=()=>{const result=actualGet();if(result.success)result.snapshot.instances=[{instance:'test',updatedAt:Date.now(),receivedRevision:result.snapshot.state.revision,audioRevision:result.snapshot.state.revision,processing:true,modules:[1,1,1],audioService:true,evidence:{state:1,hash:pluginFingerprint(result.snapshot.state.values),blocks:1,input:1,output:1,delta:[0,0,0]}}];return result};
  const api=createCommunity({store,request:(route,init={})=>f.call(route.slice('/community/profiles'.length),init.method||'GET',init.body?JSON.parse(init.body):undefined),isCosmicActive:()=>active,activateCosmic:async()=>{active=true;activations++;return async()=>{active=false}}});
  const result=await api.apply(pub.requestId);assert.equal(result.success,true);assert.equal(result.data.engineConfirmed,true);assert.equal(activations,1);assert.equal(fs.existsSync(path.join(dir,'library')),false);
  assert.equal(result.data.applications,1);
  assert.equal((await api.undo()).success,true);
  assert.equal((await(await f.call()).json()).profiles[0].applications,1);
  f.objects.set([...f.objects.keys()][0],'{}');assert.equal((await api.apply(pub.requestId)).success,false);assert.equal(activations,1);f.sqlite.close();
});
test('Electron rejects wrong hash before routing and rolls routing back on a concurrent edit',async()=>{
  const dir=path.join(scratch,randomUUID()),store=new PluginControlStore(dir,path.join(dir,'library'));store.get();
  const id=randomUUID(),data={id,version:1,payload:payload(),sha256:'wrong'};let activated=0,rolledBack=0,active=false;
  const api=createCommunity({store,request:async()=>Response.json(data),isCosmicActive:()=>active,activateCosmic:async()=>{activated++;active=true;store.patch({[require(path.join(scratch,'shared/plugin-control.cjs')).pluginParameters[5].id]:.6});return async()=>{rolledBack++;active=false}}});
  assert.equal((await api.apply(id)).code,'INVALID_PROFILE');assert.equal(activated,0);
  data.sha256=createHash('sha256').update(JSON.stringify(data.payload)).digest('hex');
  assert.equal((await api.apply(id)).code,'stale');assert.equal(activated,1);assert.equal(rolledBack,1);assert.equal(active,false);
  assert.equal(store.get().snapshot.state.values[5],.6);
});
test('Overlapping catalog and mutation requests wait in order and failures release the queue',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve});const calls=[];
  const api=createCommunity({store:{},isCosmicActive:()=>false,activateCosmic:async()=>async()=>{},request:async(route)=>{
    calls.push(route);
    if(calls.length===1){await gate;throw Error('DISCORD_HTTP_429')}
    return Response.json(route.endsWith('/favorite')?{saved:true}:{profiles:[],more:false});
  }});
  const query={tab:'explore',search:'',game:'',page:0};
  const first=api.list(query),second=api.favorite(randomUUID(),true),third=api.list({...query,tab:'saved'});
  await Promise.resolve();assert.equal(calls.length,1);release();
  const results=await Promise.all([first,second,third]);
  assert.equal(results[0].code,'DISCORD_HTTP_429');assert.equal(results[1].success,true);assert.equal(results[2].success,true);
  assert.equal(calls.length,3);assert.ok(calls[1].endsWith('/favorite'));assert.ok(calls[2].includes('tab=saved'));
});

test('Disconnected audio is not reported as confirmed',async()=>{
  const dir=path.join(scratch,randomUUID()),store=new PluginControlStore(dir,path.join(dir,'library'));store.get();
  const id=randomUUID(),p=payload();const data={id,version:1,payload:p,sha256:createHash('sha256').update(JSON.stringify(p)).digest('hex')};
  const api=createCommunity({store,request:async()=>Response.json(data),isCosmicActive:()=>true,activateCosmic:async()=>async()=>{}});
  const result=await api.apply(id);assert.equal(result.success,true);assert.equal(result.data.engineConfirmed,false);
});
test('Installed Worker blocks private R2 objects through the legacy API-key route',async()=>{
  const worker=(await import('../../AstralAudio/cloudflare-worker/src/index.js')).default;
  for(const route of ['/community-private/user/file.json','/community%2dprivate/user/file.json','/CosmicPlugins/Cosmic.dll']){
    const response=await worker.fetch(new Request('https://test'+route,{headers:{'X-Audio-API-Key':'test'}}),{AUDIO_API_KEY:'test'},{});assert.equal(response.status,403);
  }
  assert.equal((await worker.fetch(new Request('https://test/community/profiles'),{},{})).status,503);
});
