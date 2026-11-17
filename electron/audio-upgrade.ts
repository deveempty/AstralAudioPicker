import {app} from 'electron'
import fs from 'node:fs/promises'
import syncFs from 'node:fs'
import path from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {withDownloadedAsset,cleanAbandonedAudioDownloads} from './audio-download'
import {installAudioContent,type ContentManifest} from './audio-content'
import {ASTRAL_APP_DATA,EQUALIZER_APO_CONFIG} from './astral-paths'
import {audioStartupSet,audioStartupStatus} from './audio-startup'
import type {createVoicemeeter} from './voicemeeter'
import type {AudioUpgradeStatus} from '../shared/audio-upgrade'
const run=promisify(execFile)
const bootId=async()=>(await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',"(Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToUniversalTime().ToString('o')"],{windowsHide:true,timeout:15000})).stdout.trim()
const root=()=>path.join(ASTRAL_APP_DATA,'upgrade-v1')
export function preferredRelayEdition(){try{return Number(JSON.parse(syncFs.readFileSync(path.join(root(),'engine.json'),'utf8')).edition)||1}catch{return 1}}
async function save(file:string,value:unknown){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',JSON.stringify(value));await fs.rename(file+'.tmp',file)}
export function createAudioUpgrade(vm:ReturnType<typeof createVoicemeeter>,prepareLoudness:()=>Promise<void>=async()=>{},relayOnly=false){
 let state:AudioUpgradeStatus={phase:app.isPackaged?'checking':'development'},pending:Promise<AudioUpgradeStatus>|undefined
 let cleaned=false
 const set=(phase:AudioUpgradeStatus['phase'],code?:string)=>(state={phase,code})
 const script=(mode:string,engine:string,journal:string)=>run('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(process.resourcesPath,'scripts','RelayStartup.ps1'),'-Mode',mode,'-EnginePath',engine,'-JournalPath',journal],{windowsHide:true,timeout:30000})
 async function prepare(){
  if(!app.isPackaged)return set('development')
  try{
   if(!cleaned){await cleanAbandonedAudioDownloads();cleaned=true}
   if(!relayOnly){set('content')
   await installAudioContent(path.join(process.resourcesPath,'audio-update'),EQUALIZER_APO_CONFIG,ASTRAL_APP_DATA,root(),phase=>set(phase))
   await prepareLoudness()}
   const marker=path.join(root(),'relay-complete.json')
   let completed=false
   try{completed=!!JSON.parse(await fs.readFile(marker,'utf8')).completed;if(completed&&!relayOnly)return set('ready')}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT'&&!(error instanceof SyntaxError))throw error}
   set('relay')
   state.operation='relay-connect'
   const rebootMarker=path.join(root(),'awaiting-reboot.json')
   if(syncFs.existsSync(rebootMarker)){
    const pendingReboot=JSON.parse(await fs.readFile(rebootMarker,'utf8'))
    if(pendingReboot.boot===await bootId())return set('needsRestart')
    await fs.rename(rebootMarker,rebootMarker+'.completed')
   }
   let current=await vm.status()
   if(!current.installed)return set('needsInstall')
   const executables=await vm.executables()
   if(!current.connected){
    if(executables.length!==1&&!syncFs.existsSync(path.join(root(),'engine.json')))return set('needsRoute','RELAY_EDITION_REQUIRED')
    if(executables.length===1)await save(path.join(root(),'engine.json'),{edition:executables[0].edition})
    current=await vm.command({action:'connect'})
   }
   if(!current.strips[0]?.name||!current.bus.name)return set('needsRoute')
   if(completed)return set('ready')
   await save(path.join(root(),'engine.json'),{edition:current.edition})
   const engine=executables.find(e=>e.edition===current.edition)?.path
   if(!engine)throw Error('RELAY_EDITION_MISSING')
   await save(path.join(root(),'engine.json'),{edition:current.edition,path:engine})
   const journal=path.join(root(),'startup','journal.json')
   const startupBefore=path.join(root(),'startup-before.json')
   // Recover an interrupted transfer before attempting it again.
   if(syncFs.existsSync(journal)){
    await script('Restore',engine,journal)
    await fs.rename(journal,journal+'.recovered-'+Date.now())
   }
   if(syncFs.existsSync(startupBefore)){
    const previous=JSON.parse(await fs.readFile(startupBefore,'utf8'))
    if(!previous.enabled)await audioStartupSet(false)
    await fs.rename(startupBefore,startupBefore+'.recovered-'+Date.now())
   }
   state.operation='relay-startup-inspect'
   const inventory=JSON.parse((await script('Inspect',engine,journal)).stdout)
   if(inventory.conflicts.length)return set('conflict')
   // Snapshot full configuration before changing startup ownership.
   await save(path.join(root(),'relay-before.json'),current)
   const backup=path.join(root(),'voicemeeter-before-'+Date.now()+'.xml')
   state.operation='relay-backup'
   await vm.backupSettings(backup)
   const startup=await audioStartupStatus()
   await save(startupBefore,startup)
   try{
    state.operation='relay-startup-transfer'
    if(!startup.enabled)await audioStartupSet(true)
    await vm.command({action:'hide'})
    const after=await vm.status()
    state.operation='relay-readback'
    const config=(s:typeof current)=>JSON.stringify({edition:s.edition,strips:s.strips.map(({name,gain,mute})=>({name,gain,mute})),bus:{name:s.bus.name,gain:s.bus.gain,mute:s.bus.mute},settings:s.settings})
    if(!after.connected||config(after)!==config(current))throw Error('RELAY_CONFIGURATION_CHANGED')
    await script('Retire',engine,journal)
    await save(marker,{completed:true,edition:current.edition,at:new Date().toISOString()})
   }catch(error){
    await script('Restore',engine,journal)
    if(!startup.enabled)await audioStartupSet(false)
    throw error
   }
   return set('ready')
  }catch(error){console.error('Audio upgrade:',error);return set('error',error instanceof Error?error.message:'UPGRADE_FAILED')}
 }
 async function install(){
  if(!app.isPackaged)return set('development')
  if((await vm.status()).installed)return prepare()
  set('downloadingRelay')
  try{
   const dir=path.join(process.resourcesPath,'audio-update')
   const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8')) as ContentManifest
   return await withDownloadedAsset({name:'voicemeetersetup.exe',sha256:manifest.installerSha256,bytes:manifest.installerBytes},async file=>{
   const escaped=file.replaceAll("'","''")
   const ps=`$s=Get-AuthenticodeSignature -LiteralPath '${escaped}'; if($s.Status -ne 'Valid' -or $s.SignerCertificate.Subject -notmatch 'BUREL VINCENT'){throw 'INSTALLER_SIGNATURE_INVALID'}`
   await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{windowsHide:true,timeout:30000})
   set('installing')
   // Interactive vendor installer: the user can accept/cancel it and reboot later.
   try{await run(file,[],{windowsHide:false})}catch(error){if(![3010,1641].includes(Number((error as {code?:number}).code)))throw error}
   if(!(await vm.status()).installed)return set('needsInstall','INSTALL_CANCELLED')
   // Never reboot Windows automatically. Post-reboot launch resumes prepare().
   await save(path.join(root(),'awaiting-reboot.json'),{boot:await bootId()})
   return set('needsRestart')
   })
  }catch(error){console.error('Relay installation:',error);return set('error','RELAY_INSTALL_FAILED')}
 }
 return {status:()=>state,prepare:()=>pending??=(prepare().finally(()=>{pending=undefined})),install:()=>pending??=(install().finally(()=>{pending=undefined}))}
}
