import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import type {Loudness16Change,Loudness16State} from '../shared/loudness16'
const run=promisify(execFile)
export function decodeLoudness16(raw:{deviceId:string;properties:Record<string,unknown>}):Loudness16State{
 const props=raw.properties
 const binary=(v:unknown,type:number)=>Array.isArray(v)&&v.length>=12&&v[0]===type&&v.every(n=>Number.isInteger(n)&&n>=0&&n<=255)?v:undefined
 let flag:number[]|undefined,release:number[]|undefined,sawFlag=false
 for(const suffix of [0,3,1599]){
  if(props[`{fc52a749-4be9-4510-896e-966ba6525980},${suffix}`]!==undefined)sawFlag=true
  const candidate=binary(props[`{fc52a749-4be9-4510-896e-966ba6525980},${suffix}`],11)
  if(candidate){flag=candidate;release=binary(props[`{9c00eeed-edce-4cd8-ae08-cb05e8ef57a0},${suffix}`],3);break}
 }
 if(sawFlag&&!flag)throw Error('LOUDNESS_UNAVAILABLE')
 if(!release)for(const suffix of [0,3,1599]){release=binary(props[`{9c00eeed-edce-4cd8-ae08-cb05e8ef57a0},${suffix}`],3);if(release)break}
 // Missing values are Windows defaults, not an unreadable endpoint.
 const rt=release&&release[8]>=2&&release[8]<=7?release[8]:4
 const disabled=props['{1da5d803-d492-4edd-8c23-e0c0ffee7f0e},5']===1
 return {deviceId:raw.deviceId,enabled:!disabled&&!!flag&&flag[8]===255&&flag[9]===255,releaseTime:(rt-2)*20}
}
export const loudnessReadScript=`$ErrorActionPreference='Stop'
$devices=@(Get-ChildItem 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render' | Where-Object {
 $props=Get-ItemProperty -LiteralPath (Join-Path $_.PSPath 'Properties') -ErrorAction SilentlyContinue
 $props -and $props.'{a45c254e-df1c-4efd-8020-67d146a850e0},2' -eq 'CABLE In 16ch' -and $props.'{b3f8fa53-0004-438e-9003-51a46e139bfc},6' -eq 'VB-Audio Virtual Cable'
})
$active=@($devices | Where-Object {($_.GetValue('DeviceState') -band 15) -eq 1 -and ($_.GetValue('DeviceState') -band 0x10000000) -eq 0})
if($active.Count -eq 1){$devices=$active}else{$devices=@($devices | Where-Object {($_.GetValue('DeviceState') -band 15) -in @(1,2)})}
if($devices.Count -ne 1){throw 'LOUDNESS_ENDPOINT_AMBIGUOUS_OR_MISSING'}
$fx=Get-Item -LiteralPath (Join-Path $devices[0].PSPath 'FxProperties')
$values=@{}
foreach($name in $fx.GetValueNames()){
 if($name -match '^\\{(fc52a749-4be9-4510-896e-966ba6525980|9c00eeed-edce-4cd8-ae08-cb05e8ef57a0|1da5d803-d492-4edd-8c23-e0c0ffee7f0e)\\},'){$values[$name.ToLowerInvariant()]=$fx.GetValue($name)}
}
@{deviceId=$devices[0].PSChildName;properties=$values} | ConvertTo-Json -Depth 5 -Compress`
export async function readLoudness16():Promise<Loudness16State>{
 const script=loudnessReadScript
 const {stdout}=await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:15000})
 const state=decodeLoudness16(JSON.parse(stdout.replace(/^\uFEFF/,'')))
 if(!/^\{[0-9a-f-]{36}\}$/i.test(state.deviceId)||typeof state.enabled!=='boolean'||![0,20,40,60,80,100].includes(state.releaseTime))throw Error('LOUDNESS_INVALID_STATE')
 return state
}
export function createLoudness16(writeEnabled:(id:string,value:boolean)=>Promise<boolean>,writeRelease:(id:string,value:number)=>Promise<boolean>,read=readLoudness16){
 let busy=false
 return {read,async change(change:Loudness16Change){
  if(busy)throw Error('LOUDNESS_BUSY')
  if(!change||typeof change!=='object'||Object.keys(change).length!==1)throw Error('LOUDNESS_INVALID_CHANGE')
  const enabled='enabled' in change
  if(enabled?typeof change.enabled!=='boolean':!('releaseTime' in change)||![0,20,40,60,80,100].includes(change.releaseTime))throw Error('LOUDNESS_INVALID_CHANGE')
  busy=true
  try{const before=await read();const ok=enabled?await writeEnabled(before.deviceId,change.enabled):await writeRelease(before.deviceId,change.releaseTime)
   if(!ok)throw Error('LOUDNESS_WRITE_OR_RESTART_FAILED')
   const after=await read();if(after.deviceId!==before.deviceId||(enabled?after.enabled!==change.enabled:after.releaseTime!==change.releaseTime))throw Error('LOUDNESS_READBACK_FAILED')
   return after
  }finally{busy=false}
 }}
}
