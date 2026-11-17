const fs=require('node:fs'),assert=require('node:assert/strict'),esbuild=require('esbuild');
fs.mkdirSync('output/apo-empty-originals',{recursive:true});
esbuild.buildSync({entryPoints:['electron/apo-repair-plan.ts','electron/apo-chain.ts','electron/apo-repair.ts'],bundle:true,platform:'node',format:'cjs',outdir:'output/apo-empty-originals'});
const {planApoRepair,fxSlot,apoIds,windowsLoudnessIds}=require('../output/apo-empty-originals/apo-repair-plan.js');
const {apoChainFromInventory,verifyApoChain}=require('../output/apo-empty-originals/apo-chain.js');
const {createApoRepair}=require('../output/apo-empty-originals/apo-repair.js');
const str=value=>({kind:'String',value});
// Same relevant registry state as the 3.1.18 customer report; anonymized IDs.
function fixture(){
 const backup=Object.fromEntries([1,2,5,6,7].map(n=>[fxSlot(n),str('!VALUE')]));
 const endpoint=(id,name,state)=>({id,name,state,adapter:'VB-Audio Virtual Cable',fx:{[fxSlot(1)]:str(apoIds.pre),[fxSlot(2)]:str(apoIds.post),'{1da5d803-d492-4edd-8c23-e0c0ffee7f0e},5':{kind:'DWord',value:0},'unrelated-binary':{kind:'Binary',value:[11,0,0,0,1,0,0,0,255,255,0,0]}},child:{...structuredClone(backup),Version:str('2'),PreMixChild:str(''),PostMixChild:str(''),AllowSilentBufferModification:str('false')}});
 const legacy=endpoint('{11111111-1111-1111-1111-111111111111}','Cable Input 7.1',1);
 for(const n of [1,5])legacy.child[fxSlot(n)]=str(windowsLoudnessIds.pre);
 for(const n of [2,6])legacy.child[fxSlot(n)]=str(windowsLoudnessIds.post);
 legacy.child.PreMixChild=str(windowsLoudnessIds.pre);legacy.child.PostMixChild=str(windowsLoudnessIds.post);
 return {registered:true,windowsLoudnessAvailable:true,dlls:Object.fromEntries(Object.values(windowsLoudnessIds).map(id=>[id,'C:\\Windows\\System32\\WMALFXGFXDSP.dll'])),endpoints:[legacy,endpoint('{22222222-2222-2222-2222-222222222222}','CABLE In 16ch',0x10000001)]};
}
function apply(inv,patches){for(const p of patches){const e=inv.endpoints.find(e=>e.id===p.id);for(const group of ['fx','child'])for(const [key,value]of Object.entries(p[group]))if(value===null)delete e[group][key];else e[group][key]=value}}
(async()=>{
 const inv=fixture(),before=structuredClone(inv),patches=planApoRepair(inv);
 assert.throws(()=>verifyApoChain(apoChainFromInventory(inv)),/APO_CHAIN_UNCONFIRMED/);
 assert.equal(patches.length,1);assert.equal(patches[0].name,'CABLE In 16ch');
 assert.deepEqual(patches[0].fx,{});assert.deepEqual(Object.keys(patches[0].child).sort(),['PostMixChild','PreMixChild']);
 apply(inv,patches);verifyApoChain(apoChainFromInventory(inv));assert.equal(apoChainFromInventory(inv).active,false);
 assert.deepEqual(inv.endpoints[0],before.endpoints[0]);assert.deepEqual(inv.endpoints[1].fx,before.endpoints[1].fx);
 for(const n of [1,2,5,6,7])assert.deepEqual(inv.endpoints[1].child[fxSlot(n)],before.endpoints[1].child[fxSlot(n)],'uninstall history stays truthful');
 assert.deepEqual(planApoRepair(inv),[],'repair is idempotent');
 for(const mutate of [i=>delete i.windowsLoudnessAvailable,i=>i.windowsLoudnessAvailable=false,i=>delete i.dlls[windowsLoudnessIds.pre],i=>delete i.endpoints[1].child[fxSlot(1)],i=>i.endpoints[1].child[fxSlot(5)]=str(windowsLoudnessIds.pre),i=>i.endpoints[1].child.PreMixChild=str('{33333333-3333-3333-3333-333333333333}'),i=>i.endpoints[1].fx[fxSlot(13)]={kind:'MultiString',value:[windowsLoudnessIds.pre]}]){
  const bad=fixture();mutate(bad);assert.throws(()=>planApoRepair(bad),/APO_ORIGINAL_EFFECTS_UNKNOWN/);
 }
 // A different 7.1 chain cannot become the source for the 16ch provision.
 const custom=fixture(),foreign='{44444444-4444-4444-4444-444444444444}';custom.dlls[foreign]='C:\\Vendor\\custom.dll';
 for(const n of [1,2,5,6])custom.endpoints[0].child[fxSlot(n)]=str(foreign);
 custom.endpoints[0].child.PreMixChild=str(foreign);custom.endpoints[0].child.PostMixChild=str(foreign);
 assert.equal(planApoRepair(custom)[0].child.PreMixChild.value,windowsLoudnessIds.pre);
 // Same narrow recovery is available on 7.1; its active/disabled state is preserved.
 const both=fixture();both.endpoints[0].child=structuredClone(both.endpoints[1].child);assert.equal(planApoRepair(both).length,2);
 let live=fixture(),writes=0,reconnects=0;const repair=createApoRepair(async op=>{reconnects++;return op()},{read:async()=>structuredClone(live),pending:()=>false,write:async p=>{writes++;apply(live,p)}});
 await repair();verifyApoChain(apoChainFromInventory(live));await repair();assert.equal(writes,1);assert.equal(reconnects,1);
 console.log('PASS: reported empty-originals state, both cables, verified Windows effects only, truthful uninstall backup, no foreign/cross-endpoint copying, disabled endpoint preserved, chain readback and retry idempotence. No live audio writes.');
})().catch(e=>{console.error(e);process.exitCode=1});
