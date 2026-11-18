import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {PluginControlStore,pluginControlDirectory} from './plugin-control'
import {CUSTOM_OUTPUT_DLL} from './custom-output'
import {pluginFingerprint,type PluginResult} from '../shared/plugin-control'
import type {DiagnosticCheck} from '../shared/diagnostics'

// A registry entry or a plugin editor heartbeat is not proof of Windows DSP.
export async function readCosmicHosts():Promise<number[]> {
 const dll=CUSTOM_OUTPUT_DLL.replace(/'/g,"''")
 const script=`$ErrorActionPreference='Stop'; $ids=@(Get-Process audiodg -ErrorAction SilentlyContinue | ForEach-Object { $p=$_; if(@($p.Modules | Where-Object { $_.FileName -ieq '${dll}' }).Count -gt 0){$p.Id} }); ConvertTo-Json -InputObject $ids -Compress`
 const {stdout}=await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:10000,maxBuffer:65536})
 const ids:unknown=JSON.parse(stdout)
 if(!Array.isArray(ids)||!ids.every(id=>Number.isSafeInteger(id)&&id>0))throw Error('COSMIC_HOST_READ_FAILED')
 return ids
}

export function assessCosmicRuntime(before:PluginResult,after:PluginResult,hosts:number[]|null,now=Date.now()):DiagnosticCheck {
 const row=(status:DiagnosticCheck['status'],detail:string):DiagnosticCheck=>({id:'cosmicRuntime',status,detail})
 if(!before.success||!after.success)return row('unknown','cosmicRuntimeUnreadable')
 const recent=after.snapshot.instances.filter(i=>now>=i.updatedAt&&now-i.updatedAt<1500)
 if(!recent.length)return row('warning','cosmicRuntimeOffline')
 if(hosts===null)return row('unknown','cosmicRuntimeHostUnknown')
 const audio=recent.filter(i=>i.pid!==undefined&&hosts.includes(i.pid))
 if(!audio.length)return row('warning','cosmicRuntimeNotWindows')
 const hash=pluginFingerprint(after.snapshot.state.values)
 for(const instance of audio){
  const e=instance.evidence,previous=before.snapshot.instances.find(i=>i.instance===instance.instance)
  if(!instance.processing||e?.state!==1||e.hash!==hash||instance.audioRevision<after.snapshot.state.revision)continue
  if([31,36,43].some((index,module)=>after.snapshot.state.values[index]>=.5&&instance.modules[module]!==1))continue
  if(!previous?.evidence||e.blocks<=previous.evidence.blocks)continue
  if(e.input<=1e-5&&previous.evidence.input<=1e-5)return row('unknown','cosmicRuntimeSilence')
  return row('ok','cosmicRuntimeConfirmed')
 }
 return row('warning','cosmicRuntimeUnconfirmed')
}

export async function cosmicRuntimeCheck():Promise<DiagnosticCheck> {
 const store=new PluginControlStore(pluginControlDirectory())
 const before=store.inspect()
 const hosts=await readCosmicHosts().catch(()=>null)
 await new Promise(resolve=>setTimeout(resolve,450))
 return assessCosmicRuntime(before,store.inspect(),hosts)
}
