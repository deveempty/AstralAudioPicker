const assert=require('node:assert/strict'),fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),vm=require('node:vm'),esbuild=require('esbuild'),util=require('node:util');
const code=esbuild.transformSync(fs.readFileSync('electron/audio-upgrade.ts','utf8'),{loader:'ts',format:'cjs',target:'node18'}).code;
async function scenario({installed=true,route=true,conflict=false,retireFails=false,completed=false,executables=[{edition:1,path:'C:\\VB\\voicemeeter.exe'}]}={}){
 const dir=await fsp.mkdtemp(path.resolve('output/relay-upgrade-test-'));let startup=false,retired=false,content=0,commands=[],calls=[];
 if(completed){await fsp.mkdir(path.join(dir,'upgrade-v1'));await fsp.writeFile(path.join(dir,'upgrade-v1','relay-complete.json'),'{"completed":true}')}
 const state={installed,connected:installed,edition:1,inputs:[],outputs:[],strips:[{name:route?'Cable':'',gain:0,mute:false}],bus:{name:route?'Headphones':'',gain:-4,mute:false},settings:{wdm:256,sr:48000}};
 const engine={status:async()=>state,executables:async()=>executables,command:async c=>{commands.push(c);return state},backupSettings:async p=>fsp.writeFile(p,'<voicemeeter/>')};
 const execFile=()=>{};execFile[util.promisify.custom]=async(_exe,args)=>{const mode=args[args.indexOf('-Mode')+1];calls.push(mode);if(mode==='Inspect')return {stdout:JSON.stringify({entries:[],conflicts:conflict?['other-task']:[]})};if(mode==='Retire'){retired=true;if(retireFails)throw Error('TEST_RETIRE_FAILURE')}if(mode==='Restore')retired=false;return {stdout:''}};
 const mod={exports:{}};vm.runInNewContext(code,{module:mod,exports:mod.exports,console:{error:()=>{}},process:{resourcesPath:dir},require:id=>id==='electron'?{app:{isPackaged:true}}:id==='node:child_process'?{execFile}:id==='./audio-download'?{cleanAbandonedAudioDownloads:async()=>{}}:id==='./audio-content'?{installAudioContent:async()=>{content++}}:id==='./astral-paths'?{ASTRAL_APP_DATA:dir,EQUALIZER_APO_CONFIG:dir}:id==='./audio-startup'?{audioStartupStatus:async()=>({supported:true,enabled:startup}),audioStartupSet:async v=>{startup=v;return {supported:true,enabled:v}}}:require(id)});
 const api=mod.exports.createAudioUpgrade(engine);const result=await api.prepare();return {api,result,dir,get startup(){return startup},get retired(){return retired},commands,calls};
}
(async()=>{
 let test=await scenario();assert.equal(test.result.phase,'ready');assert(test.startup);assert(test.retired);assert.equal(test.commands[0].action,'hide');const count=test.calls.length;await test.api.prepare();assert.equal(test.calls.length,count,'completed migration does not transfer startup again');
 test=await scenario({installed:false});assert.equal(test.result.phase,'needsInstall');assert(!test.startup);
 test=await scenario({route:false});assert.equal(test.result.phase,'needsRoute');assert(!test.startup);
 test=await scenario({conflict:true});assert.equal(test.result.phase,'conflict');assert(!test.startup);assert(!test.retired);
 test=await scenario({retireFails:true});assert.equal(test.result.phase,'error');assert(!test.startup);assert(!test.retired);assert(!fs.existsSync(path.join(test.dir,'upgrade-v1','relay-complete.json')));
 test=await scenario({completed:true});assert.equal(test.result.phase,'ready');assert.equal(test.calls.length,0);
 test=await scenario({executables:[{edition:1,path:'C:\\VB\\voicemeeter_x64.exe'}]});assert.equal(test.result.phase,'ready');assert.equal(JSON.parse(fs.readFileSync(path.join(test.dir,'upgrade-v1','engine.json'))).path,'C:\\VB\\voicemeeter_x64.exe');
 test=await scenario({executables:[{edition:2,path:'C:\\VB\\voicemeeterpro.exe'}]});assert.equal(test.result.code,'RELAY_EDITION_MISSING');assert(!test.startup);assert.equal(test.calls.length,0);assert(!fs.existsSync(path.join(test.dir,'upgrade-v1','engine.json')),'failed detection must not save an unverified engine');
 console.log('PASS: existing engine migration, one-time completion, missing engine, incomplete route, startup conflict and rollback. Windows operations mocked.');
})().catch(e=>{console.error(e);process.exitCode=1});
