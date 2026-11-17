import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {apoIds,windowsLoudnessIds,type ApoInventory} from './apo-repair-plan'
export const apoInventoryScript=String.raw`$ErrorActionPreference='Stop'
function Read-Values($path){
 if(!(Test-Path -LiteralPath $path)){return $null};$key=Get-Item -LiteralPath $path;$result=@{}
 try{foreach($name in $key.GetValueNames()){$result[$name]=@{kind=$key.GetValueKind($name).ToString();value=$key.GetValue($name,$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)}}}finally{$key.Dispose()};return $result
}
$endpoints=@(Get-ChildItem 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render' | ForEach-Object {
 $p=Get-ItemProperty (Join-Path $_.PSPath 'Properties') -ErrorAction SilentlyContinue
 $name=$p.'{a45c254e-df1c-4efd-8020-67d146a850e0},2';$adapter=$p.'{b3f8fa53-0004-438e-9003-51a46e139bfc},6'
 if($name -in @('Cable Input 7.1','CABLE In 16ch') -and $adapter -eq 'VB-Audio Virtual Cable'){
  @{id=$_.PSChildName;name=$name;adapter=$adapter;state=$_.GetValue('DeviceState');fx=(Read-Values (Join-Path $_.PSPath 'FxProperties'));child=(Read-Values ('HKLM:\SOFTWARE\EqualizerAPO\Child APOs\'+$_.PSChildName))}
 }
})
$ids=@('${apoIds.pre}','${apoIds.post}','${windowsLoudnessIds.pre}','${windowsLoudnessIds.post}')
foreach($e in $endpoints){foreach($set in @($e.fx,$e.child)){if($set){foreach($v in $set.Values){if($v.kind -eq 'String' -and $v.value -match '^\{[a-fA-F0-9-]{36}\}$'){$ids+=$v.value}}}}}
$dlls=@{};$registered=$true
foreach($id in ($ids | Select-Object -Unique)){
 $key='Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Classes\CLSID\'+$id+'\InprocServer32'
 if(Test-Path $key){$dll=[Environment]::ExpandEnvironmentVariables((Get-Item $key).GetValue(''));if(Test-Path -LiteralPath $dll -PathType Leaf){$dlls[$id.ToLowerInvariant()]=$dll}}
}
$install=(Get-ItemProperty 'HKLM:\SOFTWARE\EqualizerAPO' -ErrorAction SilentlyContinue).InstallPath
foreach($id in @('${apoIds.pre}','${apoIds.post}')){
 if(!$install -or $dlls[$id.ToLowerInvariant()] -ne (Join-Path $install 'EqualizerAPO.dll') -or !(Test-Path ('Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Classes\AudioEngine\AudioProcessingObjects\'+$id))){$registered=$false}
}
$windowsLoudnessAvailable=$true
$windowsEffectsDll=Join-Path ([Environment]::GetFolderPath('System')) 'WMALFXGFXDSP.dll'
foreach($id in @('${windowsLoudnessIds.pre}','${windowsLoudnessIds.post}')){
 if($dlls[$id] -ne $windowsEffectsDll -or !(Test-Path ('Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Classes\AudioEngine\AudioProcessingObjects\'+$id))){$windowsLoudnessAvailable=$false}
}
@{endpoints=$endpoints;dlls=$dlls;registered=$registered;windowsLoudnessAvailable=$windowsLoudnessAvailable} | ConvertTo-Json -Depth 12 -Compress`
export async function readApoInventory():Promise<ApoInventory>{
 const {stdout}=await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',apoInventoryScript],{windowsHide:true,timeout:15000,maxBuffer:2*1024*1024})
 return JSON.parse(stdout.replace(/^\uFEFF/,''))
}
