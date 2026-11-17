import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
const run=promisify(execFile)
const quote=(value:string)=>`'${value.replaceAll("'","''")}'`

export function loudnessWriteScript(id:string,kind:'enabled'|'releaseTime',value:boolean|number,resultPath:string){
 if(!/^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/i.test(id))throw Error('LOUDNESS_INVALID_CHANGE')
 if(kind==='enabled'?typeof value!=='boolean':typeof value!=='number'||![0,20,40,60,80,100].includes(value))throw Error('LOUDNESS_INVALID_CHANGE')
 const property=kind==='enabled'?'{fc52a749-4be9-4510-896e-966ba6525980}':'{9c00eeed-edce-4cd8-ae08-cb05e8ef57a0}'
 const bytes=kind==='enabled'?`11,0,0,0,1,0,0,0,${value?'255,255':'0,0'},0,0`:`3,0,0,0,1,0,0,0,${Number(value)/20+2},0,0,0`
 return `$ErrorActionPreference='Stop'
$phase='LOUDNESS_WRITE_FAILED'
$key=$null
try {
 # Request only SetValue: requesting WriteKey also requests CreateSubKey,
 # which the Windows audio endpoint ACL deliberately does not grant.
 $key=[Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render\\${id}\\FxProperties',[Microsoft.Win32.RegistryKeyPermissionCheck]::ReadWriteSubTree,([System.Security.AccessControl.RegistryRights]::SetValue -bor [System.Security.AccessControl.RegistryRights]::QueryValues))
 if($null -eq $key){throw 'Endpoint properties missing'}
 $key.SetValue('${property},0',[byte[]]@(${bytes}),[Microsoft.Win32.RegistryValueKind]::Binary)
 ${kind==='enabled'?`# Preserve the release time when migrating a legacy-only property layout.
 $releaseName='{9c00eeed-edce-4cd8-ae08-cb05e8ef57a0},0'
 if($null -eq $key.GetValue($releaseName)) {
  foreach($suffix in @(3,1599)) {
   $previous=$key.GetValue(('{9c00eeed-edce-4cd8-ae08-cb05e8ef57a0},'+$suffix))
   if($previous -is [byte[]] -and $previous.Length -ge 12 -and $previous[0] -eq 3) {
    $key.SetValue($releaseName,$previous,[Microsoft.Win32.RegistryValueKind]::Binary)
    break
   }
  }
 }`:''}
 # Keep legacy property variants already present on this endpoint in sync.
 foreach($suffix in @(3,1599)) {
  if($key.GetValueNames() -contains ('${property},'+$suffix)) {
   $key.SetValue(('${property},'+$suffix),[byte[]]@(${bytes}),[Microsoft.Win32.RegistryValueKind]::Binary)
  }
 }
 ${kind==='enabled'&&value?"$key.SetValue('{1da5d803-d492-4edd-8c23-e0c0ffee7f0e},5',0,[Microsoft.Win32.RegistryValueKind]::DWord)":''}
 $key.Dispose();$key=$null
 $phase='LOUDNESS_RESTART_FAILED'
 # Restart only the selected render endpoint, never Audiosrv or the cable driver.
 $instanceId='SWD\\MMDEVAPI\\{0.0.0.00000000}.${id}'
 $device=Get-PnpDevice -InstanceId $instanceId -ErrorAction Stop
 if($device.Class -ne 'AudioEndpoint'){throw 'Unexpected device class'}
 $endpointState=(Get-ItemProperty -LiteralPath 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render\\${id}' -Name DeviceState).DeviceState
 if(($endpointState -band 15) -eq 2 -or ($endpointState -band 0x10000000) -ne 0){
  # A disabled endpoint adopts its saved effects when enabled next; preserve routing.
  @{ok=$true} | ConvertTo-Json -Compress | Set-Content -LiteralPath ${quote(resultPath)} -Encoding UTF8
  exit 0
 }
 & "$env:SystemRoot\\System32\\pnputil.exe" /restart-device $instanceId | Out-Null
 if($LASTEXITCODE -ne 0){throw "Endpoint restart failed: $LASTEXITCODE"}
 $ready=$false
 for($i=0;$i -lt 20;$i++){
  if((Get-PnpDevice -InstanceId $instanceId -ErrorAction Stop).Status -eq 'OK'){$ready=$true;break}
  Start-Sleep -Milliseconds 250
 }
 if(-not $ready){throw 'Endpoint did not return'}
 @{ok=$true} | ConvertTo-Json -Compress | Set-Content -LiteralPath ${quote(resultPath)} -Encoding UTF8
} catch {
 @{ok=$false;code=$phase;detail=$_.Exception.Message} | ConvertTo-Json -Compress | Set-Content -LiteralPath ${quote(resultPath)} -Encoding UTF8
 exit 1
} finally {if($null -ne $key){$key.Dispose()}}
`
}

export async function writeLoudness(id:string,kind:'enabled'|'releaseTime',value:boolean|number):Promise<boolean>{
 const dir=await mkdtemp(join(tmpdir(),'astral-loudness-'))
 try {
  const scriptPath=join(dir,'apply.ps1'),resultPath=join(dir,'result.json')
  await writeFile(scriptPath,loudnessWriteScript(id,kind,value,resultPath),'utf8')
  const launch=`$ErrorActionPreference='Stop'; $admin=([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator); if($admin){& ${quote(scriptPath)}; exit $LASTEXITCODE}; $p=Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -ArgumentList ${quote('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+scriptPath+'"')} -Wait -PassThru; exit $p.ExitCode`
  // Wait for the elevated child to finish before deleting its private files.
  try{await run('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',launch],{windowsHide:true})}catch{/* Read the child's phase-specific result below. */}
  let result:{ok:boolean;code?:string;detail?:string}
  try{result=JSON.parse((await readFile(resultPath,'utf8')).replace(/^\uFEFF/,''))}catch{throw Error('LOUDNESS_ELEVATION_FAILED')}
  if(!result.ok){console.error('Loudness operation:',result.code,result.detail);throw Error(result.code||'LOUDNESS_WRITE_FAILED')}
  return true
 }finally{await rm(dir,{recursive:true,force:true})}
}
