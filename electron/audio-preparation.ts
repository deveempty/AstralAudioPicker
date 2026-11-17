import fs from 'node:fs/promises'
import syncFs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {createPostUpdate} from './post-update'
import {installAudioContent} from './audio-content'
import {readApoChain,verifyApoChain} from './apo-chain'
import {generateBothGameEqs,resolveHeadphoneEq} from './v5-presets'
import {headphoneSource} from './v5-game-eq'
import {commitEqFiles} from './eq-transaction'
import {inspectConfigTree} from './diagnostics'
import {ASTRAL_APP_DATA,EQUALIZER_APO_CONFIG,findTargetsLibrary} from './astral-paths'
import type {VmState} from '../shared/voicemeeter'
import type {Loudness16State} from '../shared/loudness16'
import type {AudioUpgradeStatus} from '../shared/audio-upgrade'
import type {createVoicemeeter} from './voicemeeter'
import type {createAudioUpgrade} from './audio-upgrade'
import {createApoRepair} from './apo-repair'
import {readApoInventory} from './apo-inventory'

const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex')
const route=(state:VmState)=>JSON.stringify({edition:state.edition,inputs:state.strips.map(s=>({name:s.name,gain:s.gain,mute:s.mute})),output:{name:state.bus.name,gain:state.bus.gain,mute:state.bus.mute},settings:state.settings})
export function verifyRelayRoute(state:VmState){
 if(!state.connected||!state.strips[0]?.name||!state.bus.name||!state.inputs.some(d=>d.name===state.strips[0].name)||!state.outputs.some(d=>d.name===state.bus.name)||state.strips[1]?.name&&!state.inputs.some(d=>d.name===state.strips[1].name))throw Error('RELAY_ROUTE_UNCONFIRMED')
}
interface Options {
 version:string;userData:string;resources:string;previousInstall:boolean;vm:ReturnType<typeof createVoicemeeter>;relay:ReturnType<typeof createAudioUpgrade>
 loudness:{read:()=>Promise<Loudness16State>;change:(value:{enabled:boolean})=>Promise<Loudness16State>}
 selected:()=>{files:string[];v5Anchor:string|null;v5Game:'BO7'|'MW4';hasSelection:boolean}
 applyV5:(file:string)=>boolean;verifySelection:(source:string|null,game:'BO7'|'MW4')=>boolean
}
export function createAudioPreparation(options:Options){
 const {vm,relay,loudness}=options
 const repairApo=createApoRepair(operation=>vm.withEndpointRestart(operation))
 const root=path.join(ASTRAL_APP_DATA,'post-update'),versionRoot=path.join(root,options.version.replace(/[^a-zA-Z0-9.-]/g,'_'))
 const snapshotFile=path.join(versionRoot,'snapshot.json')
 type Snapshot={selection:ReturnType<Options['selected']>;relay:VmState;files:Array<{file:string;backup:string}>}
 let operation:string|undefined
 let correctionCode:string|undefined
 async function save(file:string,value:unknown){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',JSON.stringify(value));await fs.rename(file+'.tmp',file)}
 const snapshot=async()=>{const saved=JSON.parse(await fs.readFile(snapshotFile,'utf8')) as Snapshot;const correction=path.join(versionRoot,'user-correction.json');if(syncFs.existsSync(correction)){const value=JSON.parse(await fs.readFile(correction,'utf8'));if(value.selection)saved.selection=value.selection;if(value.relay)saved.relay=value.relay}return saved}
 const chain=async()=>{try{const value=await readApoChain();verifyApoChain(value);return value}catch{throw Error('APO_CHAIN_UNCONFIRMED')}}
 const runner=createPostUpdate(root,options.version,async()=>options.previousInstall,{
  snapshot:async()=>{
   operation='snapshot'
   if(correctionCode){
    const code=correctionCode;correctionCode=undefined
    const correction=path.join(versionRoot,'user-correction.json')
    let saved:Record<string,unknown>={};try{saved=JSON.parse(await fs.readFile(correction,'utf8'))}catch{}
    if(code==='HEADPHONE_SELECTION_REQUIRED')await save(correction,{...saved,selection:options.selected()})
    if(code==='RELAY_CONFIGURATION_CHANGED'||code==='RELAY_ROUTE_UNCONFIRMED'){const current=await vm.status();verifyRelayRoute(current);await save(correction,{...saved,relay:current})}
   }
   if(syncFs.existsSync(snapshotFile)){await snapshot();return}
   const selection=options.selected(),before=await vm.status()
   const files:Snapshot['files']=[]
   const candidates=[...['config.txt','at_v1.txt','at_v2.txt','aiw_v3.txt'].map(n=>path.join(EQUALIZER_APO_CONFIG,n)),path.join(options.userData,'picker-state.json')]
   // Back up all generated EQs, including additional headphones, without changing them.
   for(const folder of ['v2','v3','v5']){const dir=path.join(EQUALIZER_APO_CONFIG,'data','eq',folder);if(syncFs.existsSync(dir))for(const name of await fs.readdir(dir))if(name.endsWith('.txt'))candidates.push(path.join(dir,name))}
   await fs.mkdir(versionRoot,{recursive:true})
   for(const file of candidates){if(!syncFs.existsSync(file))continue;const backup=path.join(versionRoot,'file-'+files.length+'.backup');await fs.copyFile(file,backup);files.push({file,backup})}
   if(before.connected){const xml=path.join(versionRoot,'relay-'+Date.now()+'.xml');await vm.backupSettings(xml)}
   await save(path.join(versionRoot,'apo-before.json'),await readApoInventory().catch(()=>({unavailable:true})))
   await save(path.join(versionRoot,'loudness-before.json'),await loudness.read().catch(()=>({unavailable:true})))
   await save(snapshotFile,{selection,relay:before,files})
  },
  content:async()=>{
   await installAudioContent(path.join(options.resources,'audio-update'),EQUALIZER_APO_CONFIG,ASTRAL_APP_DATA,path.join(ASTRAL_APP_DATA,'upgrade-v1'),phase=>{operation=phase})
   const targets=findTargetsLibrary()
   if(!targets||!['Target_V2.txt','Target_V3.txt','Target_V5.txt','Target_V5_MW4.txt'].every(n=>syncFs.existsSync(path.join(targets,'Target',n))))throw Error('AUTO_EQ_TARGET_MISSING')
  },
  headphones:async progress=>{
   operation='headphones'
   const saved=await snapshot(),selection=saved.selection
   const sources=[...new Set(selection.files.map(file=>headphoneSource(file)).filter((s):s is string=>!!s))]
   if(selection.files.some(file=>path.basename(file).toLowerCase()!=='flat.txt'&&!headphoneSource(file)))throw Error('HEADPHONE_SELECTION_REQUIRED')
   if(!sources.length){if(selection.hasSelection)throw Error('HEADPHONE_SELECTION_REQUIRED');return}
   if(selection.v5Anchor&&!headphoneSource(selection.v5Anchor))throw Error('HEADPHONE_SELECTION_REQUIRED')
   // A content fingerprint permits safe retries without re-running the optimizer.
   const inputs=[...sources.map(s=>resolveHeadphoneEq(s)),...['Target_V2.txt','Target_V3.txt','Target_V5.txt','Target_V5_MW4.txt'].map(n=>path.join(findTargetsLibrary()!,'Target',n))]
   if(inputs.some(f=>!f||!syncFs.existsSync(f)))throw Error('AUTO_EQ_MEASUREMENT_INVALID')
   const fingerprint=hash(Buffer.concat(inputs.map(f=>syncFs.readFileSync(f!))))
   const marker=path.join(versionRoot,'eq-verified.json')
   try{const prior=JSON.parse(await fs.readFile(marker,'utf8'));if(prior.fingerprint===fingerprint&&prior.outputs.every((o:{file:string;sha:string})=>syncFs.existsSync(o.file)&&hash(syncFs.readFileSync(o.file))===o.sha))return}catch{/* Rebuild missing/stale output. */}
   const outputs=new Set<string>()
   for(let i=0;i<sources.length;i++){
    const source=sources[i],measurement=resolveHeadphoneEq(source)
    if(!measurement)throw Error('AUTO_EQ_MEASUREMENT_INVALID')
    const generated=await generateBothGameEqs(measurement,selection.v5Game,p=>progress((i+p.percent/100)/sources.length*100))
    for(const eq of Object.values(generated))outputs.add(eq.outputFile)
    const v5Folder=path.dirname(generated.aiwV5.outputFile)
    for(const name of await fs.readdir(v5Folder)){const file=path.join(v5Folder,name);if(name.endsWith('.txt')&&headphoneSource(file)===source)outputs.add(file)}
    // Keep legacy include filenames intact when a catalog now uses a different display name.
    const replacements=selection.files.filter(file=>headphoneSource(file)===source).map(file=>{
     const version=path.basename(path.dirname(file)),text=syncFs.readFileSync(file,'utf8')
     const from=version==='v2'?generated.atV1.outputFile:version==='v3'?generated.aiwV3.outputFile:generated.aiwV5.outputFile
     if(version==='v5'&&/# Target: MW4/.test(text)!==(selection.v5Game==='MW4'))return null
     return {target:file,data:syncFs.readFileSync(from)}
    }).filter((v):v is {target:string;data:Buffer}=>!!v)
    commitEqFiles(replacements,path.join(EQUALIZER_APO_CONFIG,'data','eq'),path.join(ASTRAL_APP_DATA,'eq-transactions'))
    for(const r of replacements)outputs.add(r.target)
    if(selection.v5Anchor&&headphoneSource(selection.v5Anchor)===source){if(!options.applyV5(generated.aiwV5.outputFile))throw Error('EQ_CONFIG_NOT_READY')}
   }
   await save(marker,{fingerprint,outputs:[...outputs].map(file=>({file,sha:hash(syncFs.readFileSync(file))}))})
  },
  apo:async()=>{await save(path.join(versionRoot,'apo-verified.json'),await repairApo(stage=>{operation=stage}))},
  loudness:async()=>{
   operation='loudness'
   const apo=await chain(),before=await loudness.read()
   if(before.deviceId.toLowerCase()!==apo.deviceId.toLowerCase())throw Error('LOUDNESS_READBACK_FAILED')
   // Every update reapplies the endpoint setting, even if an old registry
   // value already reads enabled. That flag alone is not proof of activation.
   await loudness.change({enabled:true})
   const after=await loudness.read()
   if(!after.enabled||after.deviceId!==before.deviceId||after.releaseTime!==before.releaseTime)throw Error('LOUDNESS_READBACK_FAILED')
   await save(path.join(versionRoot,'loudness-verified.json'),after)
  },
  relay:async()=>{
   operation='relay'
   const state=await relay.prepare()
   if(state.phase!=='ready')throw Error(state.code||({needsInstall:'RELAY_INSTALL_REQUIRED',needsRestart:'RELAY_RESTART_REQUIRED',conflict:'RELAY_STARTUP_CONFLICT'} as Record<string,string>)[state.phase]||'RELAY_ROUTE_UNCONFIRMED')
   const current=await vm.status();verifyRelayRoute(current)
   const saved=await snapshot()
   if(saved.relay.connected&&route(saved.relay)!==route(current))throw Error('RELAY_CONFIGURATION_CHANGED')
  },
  verify:async()=>{
   operation='verify'
   const legacy=await readApoChain('legacy');verifyApoChain(legacy)
   if(legacy.disabled)throw Error('APO_CHAIN_UNCONFIRMED')
   const apo=await chain(),leq=await loudness.read()
   if(apo.disabled||!leq.enabled||leq.deviceId.toLowerCase()!==apo.deviceId.toLowerCase())throw Error('LOUDNESS_READBACK_FAILED')
   verifyRelayRoute(await vm.status())
   const saved=await snapshot()
   if(!options.verifySelection(saved.selection.v5Anchor?headphoneSource(saved.selection.v5Anchor):null,saved.selection.v5Game))throw Error('EQ_CONFIG_NOT_READY')
   const tree=await inspectConfigTree(path.join(EQUALIZER_APO_CONFIG,'config.txt'))
   if(tree.missing.length||tree.invalid.length){await save(path.join(versionRoot,'configuration-errors.json'),tree);throw Error('AUDIO_CONFIG_INVALID')}
  },
 })
 return {
  busy:()=>runner.status().phase==='running',
  start:(force=false)=>{
   if(force&&runner.status().phase==='error')correctionCode=runner.status().code
   return runner.start(force)
  },
  status:():AudioUpgradeStatus=>{const state=runner.status(),relayState=relay.status();return {phase:state.phase==='idle'?'checking':state.phase==='ready'?'ready':state.phase==='error'?'error':'content',code:state.code,preparation:state,operation:state.step==='relay'?relayState.operation??operation:operation}},
 }
}
