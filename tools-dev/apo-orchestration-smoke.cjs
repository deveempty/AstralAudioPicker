const fs=require('node:fs'),assert=require('node:assert/strict'),esbuild=require('esbuild');
esbuild.buildSync({entryPoints:['electron/apo-repair.ts'],bundle:true,platform:'node',format:'cjs',outfile:'output/apo-lab/orchestration.js'});
const {createApoRepair}=require('../output/apo-lab/orchestration.js');
const live=require('./apo-repair-smoke.cjs').sample();
(async()=>{
 let inv=structuredClone(live),writes=0,reconnects=0,recoveries=0,progress=[];
 const apply=async patches=>{writes++;if(!patches.length){recoveries++;return}for(const p of patches){const e=inv.endpoints.find(e=>e.id===p.id);for(const group of ['fx','child']){e[group]??={};for(const [k,v]of Object.entries(p[group]))if(v===null)delete e[group][k];else e[group][k]=v}}};
 const ensure=createApoRepair(async op=>{reconnects++;return op()},{read:async()=>structuredClone(inv),write:apply,pending:()=>recoveries===0});
 await ensure(p=>progress.push(p));assert.equal(writes,2);assert.equal(recoveries,1);assert.equal(reconnects,2);assert.deepEqual(progress,['apo-inspect','apo-repair','apo-readback']);
 await ensure();assert.equal(writes,2,'healthy cables require no writes/restart');assert.equal(reconnects,2);
 let fail=true;inv=structuredClone(live);const retry=createApoRepair(op=>op(),{read:async()=>structuredClone(inv),pending:()=>false,write:async patches=>{if(fail)throw Error('APO_REPAIR_FAILED');await apply(patches)}});
 await assert.rejects(retry(),/APO_REPAIR_FAILED/);fail=false;await retry();
 inv=structuredClone(live);let release;const waiting=new Promise(r=>release=r);const busy=createApoRepair(op=>op(),{read:async()=>structuredClone(inv),pending:()=>false,write:async patches=>{await waiting;await apply(patches)}});
 const pending=busy();await assert.rejects(busy(),/AUDIO_PREPARATION_BUSY/);release();await pending;
 console.log('PASS: automatic repair, pending transaction recovery, no-op without restart, failure/retry and concurrency gating. Device operations mocked.');
})().catch(e=>{console.error(e);process.exitCode=1});
