const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const out=path.resolve('output/audio-repair-test.cjs');fs.mkdirSync(path.dirname(out),{recursive:true});
esbuild.buildSync({entryPoints:['electron/audio-repair.ts'],bundle:true,platform:'node',format:'cjs',outfile:out});
const {createAudioRepair}=require(out);
const chain={deviceId:'endpoint16',active:true,pre:true,post:true,originalPre:true,originalPost:true,disabled:false};
async function scenario(options={}){
 let writes=0,reads=0,chains=0,records=[];
 const repair=createAudioRepair({read:async()=>{reads++;return {deviceId:reads>1&&options.mismatch?'wrong':'endpoint16',enabled:reads>1&&!options.disabled,releaseTime:reads>1&&options.releaseChanged?60:20}},change:async()=>{writes++;if(options.writeError)throw Error(options.writeError)}},async e=>{if(options.logError)throw Error('access denied');records.push(e)},async()=>{if(options.repairError)throw Error(options.repairError)},async(kind)=>kind==='legacy'?chain:({...chain,...options.chain,...(++chains>1?options.after:{})}));
 const result=await repair.finish();assert.equal(repair.busy(),false);return {result,writes,records};
}
(async()=>{
 let x=await scenario();assert.deepEqual(x.result,{ok:true,active:true});assert.equal(x.writes,1);assert.deepEqual(x.records.map(r=>r.stage),['before','verified']);
 for(const field of ['pre','post','originalPre','originalPost']){x=await scenario({chain:{[field]:false}});assert.equal(x.result.code,'APO_CHAIN_UNCONFIRMED');assert.equal(x.writes,0)}
 for(const options of [{mismatch:true},{releaseChanged:true},{disabled:true},{after:{disabled:true}},{after:{deviceId:'wrong'}}]){x=await scenario(options);assert.equal(x.result.code,'LOUDNESS_READBACK_FAILED');assert(!x.records.some(r=>r.stage==='verified'))}
 x=await scenario({chain:{active:false}});assert.deepEqual(x.result,{ok:true,active:false});
 x=await scenario({after:{post:false}});assert.equal(x.result.code,'APO_CHAIN_UNCONFIRMED');
 x=await scenario({writeError:'LOUDNESS_RELAY_RESTART_FAILED'});assert.equal(x.result.code,'LOUDNESS_RELAY_RESTART_FAILED');
 x=await scenario({repairError:'APO_REPAIR_FAILED'});assert.equal(x.writes,0);assert.equal(x.result.code,'APO_REPAIR_FAILED');
 x=await scenario({logError:true});assert.equal(x.writes,0);assert.equal(x.result.ok,false);
 let release;const wait=new Promise(r=>release=r);let first=true;
 const repair=createAudioRepair({read:async()=>({deviceId:'endpoint16',enabled:true,releaseTime:0}),change:async()=>{}},async()=>{},async()=>{},async()=>{if(first){first=false;await wait}return chain});
 const one=repair.finish();assert.equal(repair.busy(),true);assert.equal((await repair.finish()).code,'AUDIO_PREPARATION_BUSY');release();assert.equal((await one).ok,true);assert.equal((await repair.finish()).ok,true);
 console.log('PASS: missing APO blocks writes; identity/release/enabled readback; inactive endpoint; relay failure; audit failure; concurrent repair and retry. No live changes.');
})().catch(e=>{console.error(e);process.exitCode=1});
