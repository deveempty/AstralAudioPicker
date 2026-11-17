const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
fs.mkdirSync('output/apo-lab',{recursive:true});
esbuild.buildSync({entryPoints:['electron/apo-repair-plan.ts','electron/apo-repair-write.ts'],bundle:true,platform:'node',format:'cjs',outdir:'output/apo-lab'});
const {planApoRepair,fxSlot,apoIds,endpointActive}=require('../output/apo-lab/apo-repair-plan.js');
const str=value=>({kind:'String',value}),pre='{62dc1a93-ae24-464c-a43e-452f824c4250}',post='{637c490d-eee3-4c0a-973f-371958802da2}';
const sample=()=>({registered:true,dlls:{[pre]:'C:\\Windows\\System32\\WMALFXGFXDSP.dll',[post]:'C:\\Windows\\System32\\WMALFXGFXDSP.dll'},endpoints:[
 {id:'{11111111-1111-1111-1111-111111111111}',name:'Cable Input 7.1',adapter:'VB-Audio Virtual Cable',state:0x10000001,child:null,fx:{[fxSlot(1)]:str(pre),[fxSlot(2)]:str(post),[fxSlot(5)]:str(pre),[fxSlot(6)]:str(post),unrelated:{kind:'Binary',value:[11,0,1,4]}}},
 {id:'{22222222-2222-2222-2222-222222222222}',name:'CABLE In 16ch',adapter:'VB-Audio Virtual Cable',state:1,child:null,fx:{[fxSlot(1)]:str(pre),[fxSlot(2)]:str(post),[fxSlot(5)]:str(pre),[fxSlot(6)]:str(post),unrelated:{kind:'DWord',value:91}}},
]});
function apply(inv,patches){for(const p of patches){const e=inv.endpoints.find(e=>e.id===p.id);for(const group of ['fx','child']){e[group]??={};for(const [key,value]of Object.entries(p[group]))if(value===null)delete e[group][key];else e[group][key]=value}}return inv}
let inv=sample(),patches=planApoRepair(inv);assert.equal(patches.length,2);assert.equal(patches[0].state,0x10000001);assert.equal(endpointActive(0x10000001),false);assert(!('unrelated' in patches[0].fx));
apply(inv,patches);assert.equal(planApoRepair(inv).length,0,'idempotent after repair');assert.equal(inv.endpoints[0].child.PreMixChild.value,pre);
delete inv.endpoints[1].fx[fxSlot(2)];assert.equal(planApoRepair(inv).length,1,'partial installation repairs only broken cable');
for(const mutate of [i=>i.endpoints.pop(),i=>i.endpoints.push({...i.endpoints[0]}),i=>i.endpoints[1].adapter='Realtek',i=>i.endpoints[1].state=4]){inv=sample();mutate(inv);assert.throws(()=>planApoRepair(inv),/APO_ENDPOINT_UNAVAILABLE/)}
inv=sample();inv.registered=false;assert.throws(()=>planApoRepair(inv),/APO_COMPONENT_UNAVAILABLE/);
for(const mutate of [i=>delete i.dlls[pre],i=>i.endpoints[1].fx[fxSlot(13)]={kind:'MultiString',value:[pre]},i=>i.endpoints[1].fx[fxSlot(7)]=str(post),i=>i.endpoints[1].fx[fxSlot(1)]=str(apoIds.pre),i=>i.endpoints[1].child={Version:str('99')}]){inv=sample();mutate(inv);assert.throws(()=>planApoRepair(inv),/APO_ORIGINAL_EFFECTS_UNKNOWN/)}
inv=sample();for(const e of inv.endpoints){delete e.fx[fxSlot(1)];delete e.fx[fxSlot(2)]}patches=planApoRepair(inv);assert.equal(patches[1].child.PreMixChild.value,pre);assert.equal(planApoRepair(apply(inv,patches)).length,0,'modern fallback keeps originals');
console.log('PASS: both cables, incomplete chains, idempotence, original effects, no foreign changes, missing/ambiguous endpoint, DLL registration, incompatible effects and inactive cable.');
if(process.argv.includes('--registry')){
 const {execFileSync,spawnSync}=require('node:child_process'),{apoRepairWriteCore}=require('../output/apo-lab/apo-repair-write.js');
 const root=fs.mkdtempSync(path.resolve('output/apo-registry-lab-')),hive='Software\\AstralAudioRepairLab\\'+path.basename(root),psq=s=>"'"+s.replaceAll("'","''")+"'";
 const run=script=>{const file=path.join(root,'run-'+Math.random().toString(36).slice(2)+'.ps1');fs.writeFileSync(file,script);return spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',file],{encoding:'utf8',windowsHide:true})};
 const fixture=sample();const payload=Buffer.from(JSON.stringify(fixture.endpoints)).toString('base64');
 const seed=`$ErrorActionPreference='Stop';$hive=[Microsoft.Win32.Registry]::CurrentUser;$root=${psq(hive)}
 $items=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}')) | ConvertFrom-Json
 foreach($e in $items){$p=$root+'\\Render\\'+$e.id;$key=$hive.CreateSubKey($p);$key.SetValue('DeviceState',[int]$e.state,[Microsoft.Win32.RegistryValueKind]::DWord);$key.Dispose();$k=$hive.CreateSubKey($p+'\\Properties');$k.SetValue('{a45c254e-df1c-4efd-8020-67d146a850e0},2',$e.name);$k.SetValue('{b3f8fa53-0004-438e-9003-51a46e139bfc},6',$e.adapter);$k.Dispose();$k=$hive.CreateSubKey($p+'\\FxProperties');foreach($v in $e.fx.PSObject.Properties){$value=if($v.Value.kind -eq 'Binary'){,[byte[]]$v.Value.value}elseif($v.Value.kind -eq 'DWord'){[int]$v.Value.value}else{[string]$v.Value.value};$kind=[Microsoft.Win32.RegistryValueKind]::$($v.Value.kind);$k.SetValue($v.Name,$value,$kind)};$k.Dispose()}`;
 const read=()=>{const r=run(`$hive=[Microsoft.Win32.Registry]::CurrentUser;$root=${psq(hive)};function Read-Key($p){$k=$hive.OpenSubKey($p);if(!$k){return $null};$v=@{};foreach($n in $k.GetValueNames()){$v[$n]=@{kind=$k.GetValueKind($n).ToString();value=$k.GetValue($n)}};$k.Dispose();return $v};$list=@();foreach($id in @('${fixture.endpoints[0].id}','${fixture.endpoints[1].id}')){$list+=@{fx=(Read-Key ($root+'\\Render\\'+$id+'\\FxProperties'));child=(Read-Key ($root+'\\Child\\'+$id))}};ConvertTo-Json -InputObject $list -Depth 12 -Compress`);assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout)};
 const cleanup=()=>{const r=run(`$root=${psq(hive)};if($root -notlike 'Software\\AstralAudioRepairLab\\apo-registry-lab-*'){throw 'Unsafe fixture root'};[Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree($root,$false)`);assert.equal(r.status,0,r.stderr)};
 const execute=(name,patches,transform=x=>x)=>{
  const dir=path.join(root,name);fs.mkdirSync(dir,{recursive:true});const result=path.join(dir,'result.json'),encoded=Buffer.from(JSON.stringify(patches)).toString('base64');
  const script=`$ErrorActionPreference='Stop';$hive=[Microsoft.Win32.Registry]::CurrentUser;$render=${psq(hive+'\\Render')};$children=${psq(hive+'\\Child')};$backupRoot=${psq(dir)};$pending=Join-Path $backupRoot 'pending.json';$resultPath=${psq(result)};$patches=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')) | ConvertFrom-Json
 function Restart-Cable($p){if(($p.state -band 15) -ne 1 -or ($p.state -band 0x10000000) -ne 0){return};Add-Content -LiteralPath ${psq(path.join(dir,'restarts.txt'))} -Value $p.name}
 `+transform(apoRepairWriteCore);
  const r=run(script);return {status:r.status,stderr:r.stderr,result:fs.existsSync(result)?JSON.parse(fs.readFileSync(result,'utf8').replace(/^\uFEFF/,'')):null,dir};
 };
 try{
  let r=run(seed);assert.equal(r.status,0,r.stderr);const before=read(),plan=planApoRepair(fixture);
  r=execute('success',plan);assert.equal(r.status,0,r.stderr+JSON.stringify(r.result));assert.equal(r.result.ok,true);let after=read();assert.equal(after[0].fx[fxSlot(1)].value,apoIds.pre);assert.deepEqual(after[1].fx.unrelated,before[1].fx.unrelated);assert.equal(fs.readFileSync(path.join(r.dir,'restarts.txt'),'utf8').trim(),'CABLE In 16ch');
  cleanup();assert.equal(run(seed).status,0);
  r=execute('rollback',plan,s=>s.replace("Save-Journal 'written'","throw 'Injected failure'"));assert.equal(r.result.ok,false);assert.equal(r.result.code,'APO_REPAIR_FAILED');assert.deepEqual(read(),before,'both endpoints roll back after partial write');
  r=execute('interrupted',plan,s=>s.replace("Save-Journal 'written'","Save-Journal 'written';exit 31"));assert.equal(r.status,31);r=execute('interrupted',[]);assert.equal(r.result.ok,true);assert.deepEqual(read(),before,'next invocation recovers an interrupted transaction');
  const conflicting=structuredClone(plan);conflicting[0].beforeFx.unrelated.value=[1];r=execute('conflict',conflicting);assert.equal(r.result.code,'APO_REPAIR_CONFLICT');assert.deepEqual(read(),before);
  console.log('PASS: real PowerShell registry writes in isolated HKCU fixtures; atomic journal, readback, both-cable rollback, crash recovery, conflict detection, preserved binary values and inactive endpoint restart exclusion.');
 }finally{cleanup()}
}

module.exports={sample};
