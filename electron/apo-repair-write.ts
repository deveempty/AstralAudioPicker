import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {mkdtemp,writeFile,readFile,rm,mkdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import type {ApoPatch} from './apo-repair-plan'
const quote=(value:string)=>`'${value.replaceAll("'","''")}'`

// All registry writes are limited to the two resolved render endpoints and their
// per-endpoint Child APOs entries. This core is also exercised against HKCU fixtures.
export const apoRepairWriteCore=String.raw`
function Read-Key($relative){
 $key=$hive.OpenSubKey($relative);if(!$key){return $null};$values=@{}
 try{foreach($n in $key.GetValueNames()){$values[$n]=@{kind=$key.GetValueKind($n).ToString();value=$key.GetValue($n,$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)}}}finally{$key.Dispose()};return $values
}
function Has($values,$name){return $null -ne $values -and @($values.PSObject.Properties.Name) -contains $name}
function Equal-Value($a,$b){
 if($null -eq $a -or $null -eq $b){return $null -eq $a -and $null -eq $b}
 return $a.kind -eq $b.kind -and (ConvertTo-Json -InputObject $a.value -Compress -Depth 5) -ceq (ConvertTo-Json -InputObject $b.value -Compress -Depth 5)
}
function Save-Journal($phase){
 $journal.phase=$phase;$json=ConvertTo-Json -InputObject $journal -Depth 20
 $bytes=[Text.Encoding]::UTF8.GetBytes($json)
 $stream=[IO.FileStream]::new($pending+'.tmp',[IO.FileMode]::Create,[IO.FileAccess]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough)
 try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
 if(Test-Path -LiteralPath $pending){[IO.File]::Replace($pending+'.tmp',$pending,$pending+'.previous-'+[Guid]::NewGuid().ToString()+'.json')}else{[IO.File]::Move($pending+'.tmp',$pending)}
}
function Validate-Plan($items){
 $seen=@{}
 foreach($p in $items){
  if($p.id -notmatch '^\{[a-fA-F0-9-]{36}\}$' -or $p.name -notin @('Cable Input 7.1','CABLE In 16ch') -or $seen.ContainsKey($p.id)){throw 'APO_REPAIR_FAILED'};$seen[$p.id]=$true
  foreach($group in @('fx','child')){foreach($prop in $p.$group.PSObject.Properties){
   $allowed=if($group -eq 'fx'){@('{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},1','{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},2','{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},5','{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},6','{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},7','{1da5d803-d492-4edd-8c23-e0c0ffee7f0e},5')}else{@('{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},1','{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},2','{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},5','{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},6','{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},7','Version','PreMixChild','PostMixChild','AllowSilentBufferModification')}
   if($prop.Name -notin $allowed){throw 'APO_REPAIR_FAILED'}
  }}
 }
}
function Check-Identity($p){
 $key=$hive.OpenSubKey($render+'\'+$p.id);if(!$key){throw 'APO_ENDPOINT_UNAVAILABLE'}
 try{if($key.GetValue('DeviceState') -ne $p.state){throw 'APO_REPAIR_CONFLICT'}}finally{$key.Dispose()}
 $props=Read-Key ($render+'\'+$p.id+'\Properties')
 if($props['{a45c254e-df1c-4efd-8020-67d146a850e0},2'].value -ne $p.name -or $props['{b3f8fa53-0004-438e-9003-51a46e139bfc},6'].value -ne 'VB-Audio Virtual Cable'){throw 'APO_REPAIR_CONFLICT'}
}
function Write-Value($key,$name,$v){
 if($null -eq $v){$key.DeleteValue($name,$false);return}
 $kind=[Microsoft.Win32.RegistryValueKind]::$($v.kind)
 $value=switch($v.kind){'Binary'{,[byte[]]$v.value};'MultiString'{,[string[]]$v.value};'DWord'{[int]$v.value};'QWord'{[long]$v.value};default{[string]$v.value}}
 $key.SetValue($name,$value,$kind)
}
function Apply-Values($p,$rollback){
 Check-Identity $p
 foreach($group in @('child','fx')){
  $relative=if($group -eq 'fx'){$render+'\'+$p.id+'\FxProperties'}else{$children+'\'+$p.id}
  $before=if($group -eq 'fx'){$p.beforeFx}else{$p.beforeChild}
  $key=if($group -eq 'child'){$hive.CreateSubKey($relative)}else{$hive.OpenSubKey($relative,[Microsoft.Win32.RegistryKeyPermissionCheck]::ReadWriteSubTree,([System.Security.AccessControl.RegistryRights]::SetValue -bor [System.Security.AccessControl.RegistryRights]::QueryValues))}
  if(!$key){throw 'APO_REPAIR_FAILED'}
  try{foreach($prop in $p.$group.PSObject.Properties){
   $old=if(Has $before $prop.Name){$before.($prop.Name)}else{$null}
   if($rollback){
    $current=if($key.GetValueNames() -contains $prop.Name){@{kind=$key.GetValueKind($prop.Name).ToString();value=$key.GetValue($prop.Name)}}else{$null}
    if(!(Equal-Value $current $old) -and !(Equal-Value $current $prop.Value)){throw 'APO_REPAIR_ROLLBACK_FAILED'}
   }
   Write-Value $key $prop.Name $(if($rollback){$old}else{$prop.Value})
  };$key.Flush()}finally{$key.Dispose()}
  if($rollback -and $group -eq 'child' -and $null -eq $before){
   $left=$hive.OpenSubKey($relative);$empty=$left -and $left.ValueCount -eq 0 -and $left.SubKeyCount -eq 0;if($left){$left.Dispose()};if($empty){$hive.DeleteSubKey($relative,$false)}
  }
 }
}
function Verify-Values($p,$rollback){
 Check-Identity $p
 foreach($group in @('fx','child')){
  $relative=if($group -eq 'fx'){$render+'\'+$p.id+'\FxProperties'}else{$children+'\'+$p.id}
  $current=Read-Key $relative;$before=if($group -eq 'fx'){$p.beforeFx}else{$p.beforeChild}
  foreach($prop in $p.$group.PSObject.Properties){
   $expected=if($rollback){if(Has $before $prop.Name){$before.($prop.Name)}else{$null}}else{$prop.Value}
   $actual=if($current){$current[$prop.Name]}else{$null}
   if(!(Equal-Value $actual $expected)){throw 'APO_REPAIR_FAILED'}
  }
 }
}
function Recover-Journal{
 Validate-Plan $journal.patches
 foreach($p in $journal.patches){Apply-Values $p $true;Verify-Values $p $true}
 foreach($p in $journal.patches){Restart-Cable $p}
 Save-Journal 'rolledBack'
 [IO.File]::Move($pending,$pending+'.recovered-'+[Guid]::NewGuid().ToString()+'.json')
}
$lock=$null;$journal=$null;$started=$false
try{
 try{$lock=[IO.File]::Open((Join-Path $backupRoot 'repair.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)}catch{throw 'AUDIO_PREPARATION_BUSY'}
 if(Test-Path -LiteralPath $pending){
  $journal=Get-Content -LiteralPath $pending -Raw | ConvertFrom-Json
  if($journal.phase -notin @('committed','rolledBack')){try{Recover-Journal}catch{throw 'APO_REPAIR_ROLLBACK_FAILED'}}
  else{[IO.File]::Move($pending,$pending+'.finished-'+[Guid]::NewGuid().ToString()+'.json')}
 }
 if($patches.Count -eq 0){@{ok=$true;changed=0} | ConvertTo-Json -Compress | Set-Content -LiteralPath $resultPath -Encoding UTF8;exit 0}
 Validate-Plan $patches
 foreach($p in $patches){
  Check-Identity $p
  # Compare every saved value, not just patches, before taking ownership of a write.
  foreach($group in @('fx','child')){
   $relative=if($group -eq 'fx'){$render+'\'+$p.id+'\FxProperties'}else{$children+'\'+$p.id}
   $before=if($group -eq 'fx'){$p.beforeFx}else{$p.beforeChild};$current=Read-Key $relative
   if(($null -eq $before) -ne ($null -eq $current)){throw 'APO_REPAIR_CONFLICT'}
   if($current){if($current.Count -ne @($before.PSObject.Properties).Count){throw 'APO_REPAIR_CONFLICT'};foreach($prop in $before.PSObject.Properties){if(!(Equal-Value $current[$prop.Name] $prop.Value)){throw 'APO_REPAIR_CONFLICT'}}}
  }
 }
 $journal=@{phase='prepared';at=[DateTime]::UtcNow.ToString('o');patches=@($patches | ForEach-Object {$_})};Save-Journal 'prepared'
 $started=$true
 foreach($p in $patches){Apply-Values $p $false;Verify-Values $p $false}
 Save-Journal 'written'
 foreach($p in $patches){Restart-Cable $p;Verify-Values $p $false}
 Save-Journal 'committed'
 [IO.File]::Move($pending,$pending+'.completed-'+[Guid]::NewGuid().ToString()+'.json')
 @{ok=$true;changed=$patches.Count} | ConvertTo-Json -Compress | Set-Content -LiteralPath $resultPath -Encoding UTF8
}catch{
 $detail=$_.Exception.Message;$code=if($detail -match '^(APO_[A-Z_]+|AUDIO_PREPARATION_BUSY)$'){$detail}else{'APO_REPAIR_FAILED'}
 if($started){try{Recover-Journal}catch{$code='APO_REPAIR_ROLLBACK_FAILED';$detail+=' / '+$_.Exception.Message}}
 @{ok=$false;code=$code;detail=$detail;trace=$_.ScriptStackTrace} | ConvertTo-Json -Compress | Set-Content -LiteralPath $resultPath -Encoding UTF8
 exit 1
}finally{if($lock){$lock.Dispose()}}
`
export function apoRepairWriteScript(patches:ApoPatch[],backupRoot:string,resultPath:string){
 const encoded=Buffer.from(JSON.stringify(patches)).toString('base64')
 return `$ErrorActionPreference='Stop'
$hive=[Microsoft.Win32.Registry]::LocalMachine
$render='SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render'
$children='SOFTWARE\\EqualizerAPO\\Child APOs'
$backupRoot=${quote(backupRoot)}
$pending=Join-Path $backupRoot 'pending.json'
$resultPath=${quote(resultPath)}
$patches=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')) | ConvertFrom-Json
function Restart-Cable($p){
 if(($p.state -band 15) -ne 1 -or ($p.state -band 0x10000000) -ne 0){return}
 $id='SWD\\MMDEVAPI\\{0.0.0.00000000}.'+$p.id
 $device=Get-PnpDevice -InstanceId $id -ErrorAction Stop
 if($device.Class -ne 'AudioEndpoint'){throw 'APO_ENDPOINT_UNAVAILABLE'}
 & "$env:SystemRoot\\System32\\pnputil.exe" /restart-device $id | Out-Null
 if($LASTEXITCODE -ne 0){throw 'APO_RESTART_FAILED'}
 for($i=0;$i -lt 20;$i++){if((Get-PnpDevice -InstanceId $id -ErrorAction Stop).Status -eq 'OK'){return};Start-Sleep -Milliseconds 250}
 throw 'APO_RESTART_FAILED'
}
${apoRepairWriteCore}`
}
export async function writeApoRepair(patches:ApoPatch[],backupRoot:string){
 await mkdir(backupRoot,{recursive:true})
 const dir=await mkdtemp(path.join(tmpdir(),'astral-apo-repair-'))
 try{
  const script=path.join(dir,'repair.ps1'),resultPath=path.join(dir,'result.json')
  await writeFile(script,apoRepairWriteScript(patches,backupRoot,resultPath),'utf8')
  const launch=`$ErrorActionPreference='Stop';$admin=([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator);if($admin){& ${quote(script)};exit $LASTEXITCODE};$p=Start-Process powershell.exe -Verb RunAs -WindowStyle Hidden -ArgumentList ${quote('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+script+'"')} -Wait -PassThru;exit $p.ExitCode`
  try{await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',launch],{windowsHide:true})}catch{/* Read the helper result after it has exited. */}
  let result:{ok:boolean;code?:string;detail?:string}
  try{result=JSON.parse((await readFile(resultPath,'utf8')).replace(/^\uFEFF/,''))}catch{throw Error('APO_REPAIR_ELEVATION_FAILED')}
  if(!result.ok)throw new Error(result.code||'APO_REPAIR_FAILED',{cause:result.detail})
 }finally{await rm(dir,{recursive:true,force:true})}
}
