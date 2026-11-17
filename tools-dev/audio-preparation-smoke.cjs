const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),esbuild=require('esbuild');
function load(file,mocks={}){const mod={exports:{}};vm.runInNewContext(esbuild.transformSync(fs.readFileSync(file,'utf8'),{loader:'ts',format:'cjs',target:'node18'}).code,{module:mod,exports:mod.exports,require:id=>id in mocks?mocks[id]:require(id),process,console,Buffer,setTimeout,Error});return mod.exports}
const shared=load('shared/post-update.ts'),post=load('electron/post-update.ts',{'../shared/post-update':shared}),transaction=load('electron/eq-transaction.ts'),eqHelpers=load('electron/v5-game-eq.ts');
const eq=(target)=>`# Source file: reviewer/headphone.txt\n# Target: ${target}\nPreamp: -2.0 dB\n`+Array.from({length:10},(_,i)=>`Filter ${i+1}: ON PK Fc 100 Hz Gain 1.0 dB Q 1.0`).join('\n');
async function scenario({fresh=false,apoOk=true,repairFails=false,missingOutput=false,noSource=false,readbackFails=false,initiallyEnabled=false,writeFails=false}={}){
 const root=fs.mkdtempSync(path.resolve('output/preparation-lab-')),apo=path.join(root,'apo'),targets=path.join(root,'targets');fs.mkdirSync(path.join(targets,'Target'),{recursive:true});
 for(const name of ['Target_V2.txt','Target_V3.txt','Target_V5.txt','Target_V5_MW4.txt'])fs.writeFileSync(path.join(targets,'Target',name),'target');
 for(const name of ['v2','v3','v5'])fs.mkdirSync(path.join(apo,'data','eq',name),{recursive:true});fs.writeFileSync(path.join(apo,'config.txt'),'config');
 const anchor=path.join(apo,'data','eq','v5','headphone.txt');fs.writeFileSync(anchor,noSource?'unknown':eq('BO7 Target V5'));const other=path.join(apo,'data','eq','v5','other.txt');fs.writeFileSync(other,'other customer EQ');
 const measurement=path.join(root,'measurement.txt');fs.writeFileSync(measurement,'measurement');let writes=0,generated=0,content=0,enabled=initiallyEnabled,currentFile=anchor,validApo=apoOk,repairCalls=0;
 const state={connected:true,installed:true,edition:1,inputs:[{name:'Cable'}],outputs:missingOutput?[]:[{name:'Headphones'}],strips:[{name:'Cable',gain:0,mute:false},{name:'',gain:0,mute:false}],bus:{name:'Headphones',gain:0,mute:false},settings:{sr:48000}};
 const mocks={
  './apo-inventory':{readApoInventory:async()=>({endpoints:[]})},
  './apo-repair':{createApoRepair:()=>async()=>{repairCalls++;if(!validApo&&repairFails)throw Error('APO_REPAIR_FAILED');validApo=true;return {endpoints:[{name:'Cable Input 7.1'},{name:'CABLE In 16ch'}]}}},
  './post-update':post,'./eq-transaction':transaction,'./v5-game-eq':eqHelpers,
  './astral-paths':{ASTRAL_APP_DATA:root,EQUALIZER_APO_CONFIG:apo,findTargetsLibrary:()=>targets},
  './audio-content':{installAudioContent:async()=>{content++}},
  './apo-chain':{readApoChain:async()=>({deviceId:'endpoint16',disabled:false,pre:validApo}),verifyApoChain:c=>{if(!c.pre)throw Error('APO_CHAIN_UNCONFIRMED')}},
  './diagnostics':{inspectConfigTree:async()=>({missing:[],invalid:[]})},
  './v5-presets':{resolveHeadphoneEq:source=>source==='reviewer/headphone.txt'?measurement:null,generateBothGameEqs:async(_m,game,progress)=>{
   generated++;const result={};for(const [key,folder,target,name] of [['atV1','v2','BO7 Target V2','headphone'],['aiwV3','v3','BO7 Target V3','headphone'],['aiwV5','v5',game+' Target V5',game==='MW4'?'headphone - MW4 V5':'headphone']]){const file=path.join(apo,'data','eq',folder,name+'.txt');fs.writeFileSync(file,eq(target));result[key]={outputFile:file}}progress({percent:100});return result;
  }},
 };
 const {createAudioPreparation}=load('electron/audio-preparation.ts',mocks);
 const options={version:'9.9.9',userData:root,resources:root,previousInstall:!fresh,
  vm:{status:async()=>state,backupSettings:async p=>fs.writeFileSync(p,'<xml/>')},relay:{status:()=>({phase:'ready'}),prepare:async()=>({phase:'ready'})},
  loudness:{read:async()=>({deviceId:'endpoint16',enabled,releaseTime:20}),change:async value=>{assert.equal(value.enabled,true);assert.equal(Object.keys(value).length,1);writes++;if(writeFails)throw Error('LOUDNESS_WRITE_OR_RESTART_FAILED');enabled=!readbackFails;return {deviceId:'endpoint16',enabled,releaseTime:20}}},
  selected:()=>({files:[anchor],v5Anchor:anchor,v5Game:'MW4',hasSelection:true}),applyV5:file=>{currentFile=file;return true},verifySelection:(source,game)=>eqHelpers.headphoneSource(currentFile)===source&&fs.readFileSync(currentFile,'utf8').includes(`# Target: ${game} Target V5`),
 };
 const app=createAudioPreparation(options);await app.start();assert.equal(fs.readFileSync(other,'utf8'),'other customer EQ');return {app,root,get repairCalls(){return repairCalls},get writes(){return writes},get generated(){return generated},get content(){return content},fixApo:()=>validApo=true,nextVersion:async()=>{enabled=false;const next=createAudioPreparation({...options,version:'9.9.10'});await next.start();return next}};
}
(async()=>{
 let s=await scenario({fresh:true});assert.equal(s.app.status().phase,'ready');assert.equal(s.content,0);assert.equal(s.writes,0);assert.equal(s.generated,0);
 s=await scenario();assert.equal(s.app.status().phase,'ready');assert.equal(s.writes,1);assert.equal(s.generated,1);await s.app.start();assert.equal(s.writes,1);
 const next=await s.nextVersion();assert.equal(next.status().phase,'ready');assert.equal(s.writes,2,'a new update must enable LEQ again');
 s=await scenario({initiallyEnabled:true});assert.equal(s.app.status().phase,'ready');assert.equal(s.writes,1,'enabled readback must not skip activation after update');await s.app.start();assert.equal(s.writes,1,'ordinary launches must not reapply a completed update');
 s=await scenario({initiallyEnabled:true,writeFails:true});assert.equal(s.app.status().code,'LOUDNESS_WRITE_OR_RESTART_FAILED');assert.equal(s.app.status().preparation.step,'loudness');assert.notEqual(JSON.parse(fs.readFileSync(path.join(s.root,'post-update/post-update.json'))).phase,'ready');
 s=await scenario({apoOk:false});assert.equal(s.app.status().phase,'ready');assert.equal(s.repairCalls,1,'update automatically repairs missing APO before LEQ');
 s=await scenario({apoOk:false,repairFails:true});assert.equal(s.app.status().code,'APO_REPAIR_FAILED');assert.equal(s.writes,0);s.fixApo();await s.app.start(true);assert.equal(s.app.status().phase,'ready');assert.equal(s.generated,1,'retry must reuse verified EQ');
 s=await scenario({missingOutput:true});assert.equal(s.app.status().code,'RELAY_ROUTE_UNCONFIRMED');assert.notEqual(JSON.parse(fs.readFileSync(path.join(s.root,'post-update/post-update.json'))).phase,'ready');
 s=await scenario({noSource:true});assert.equal(s.app.status().code,'HEADPHONE_SELECTION_REQUIRED');assert.equal(s.writes,0);
 s=await scenario({readbackFails:true});assert.equal(s.app.status().code,'LOUDNESS_READBACK_FAILED');
 console.log('PASS: complete preparation pipeline, fresh-install exclusion, exact measurement reuse, MW4 selection, other headphones preserved, APO-before-LEQ gating, LEQ readback failure, absent Relay output, safe retry reuses EQ. Windows/optimizer/download mocked.');
})().catch(e=>{console.error(e);process.exitCode=1});
