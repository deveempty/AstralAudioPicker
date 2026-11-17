param(
 [Parameter(Mandatory=$true)][string]$SourceDirectory,
 [string]$DestinationDirectory=(Join-Path $env:ProgramData 'AstralAudio\icons'),
 [switch]$Apply
)
$ErrorActionPreference='Stop'
$files=@('astral-audio-switch-borde-gradient.ico','astral-audio-output-mix-v2.ico','astral-audio-switch-v2.ico')
foreach($file in $files){if(-not (Test-Path -LiteralPath (Join-Path $SourceDirectory $file))){throw "Missing icon: $file"}}
$nameKey='{a45c254e-df1c-4efd-8020-67d146a850e0},2'
$adapterKey='{b3f8fa53-0004-438e-9003-51a46e139bfc},6'
$iconKey='{259abffc-50a7-47ce-af08-68c9a7d73366},12'
$changes=@()
foreach($flow in @('Render','Capture')){
 $root="SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\$flow"
 foreach($endpoint in Get-ChildItem "Registry::HKEY_LOCAL_MACHINE\$root"){
  $props=Get-ItemProperty -LiteralPath (Join-Path $endpoint.PSPath 'Properties')
  $name=[string]$props.$nameKey; $adapter=[string]$props.$adapterKey; $file=$null
  if($adapter -eq 'VB-Audio Virtual Cable'){
   if($flow -eq 'Render' -and $name -in @('Cable Input 7.1','CABLE In 16ch')){$file=$files[0]}
   if($flow -eq 'Capture' -and $name -eq 'CABLE Output'){$file=$files[1]}
  }elseif($adapter -like 'VB-Audio Voicemeeter*' -and $name -like 'Voicemeeter *'){$file=$files[2]}
  if(-not $file){continue}
  $target=(Join-Path $DestinationDirectory $file)+',0'
  if([string]$props.$iconKey -eq $target){continue}
  $changes+=@{flow=$flow;id=$endpoint.PSChildName;name=$name;previous=$props.$iconKey;target=$target;key="$root\$($endpoint.PSChildName)\Properties"}
 }
}
if($Apply){
 New-Item -ItemType Directory -Path $DestinationDirectory -Force | Out-Null
 foreach($file in $files){
  $source=Join-Path $SourceDirectory $file; $target=Join-Path $DestinationDirectory $file
  if(-not (Test-Path -LiteralPath $target) -or (Get-FileHash -LiteralPath $source).Hash -ne (Get-FileHash -LiteralPath $target).Hash){Copy-Item -LiteralPath $source -Destination $target -Force}
 }
 if($changes.Count){
  $backup=Join-Path $DestinationDirectory 'backups'
  New-Item -ItemType Directory -Path $backup -Force | Out-Null
  $changes | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $backup (([guid]::NewGuid().ToString())+'.json')) -Encoding UTF8
 }
 foreach($change in $changes){
  $key=$null
  try{
   $key=[Microsoft.Win32.Registry]::LocalMachine.OpenSubKey($change.key,[Microsoft.Win32.RegistryKeyPermissionCheck]::ReadWriteSubTree,[System.Security.AccessControl.RegistryRights]::SetValue)
   if($null -eq $key){throw 'Endpoint disappeared'}
   $key.SetValue($iconKey,$change.target,[Microsoft.Win32.RegistryValueKind]::String)
  }finally{if($null -ne $key){$key.Dispose()}}
  if((Get-ItemProperty -LiteralPath ('Registry::HKEY_LOCAL_MACHINE\'+$change.key)).$iconKey -ne $change.target){throw 'Icon readback mismatch'}
 }
}
@{applied=[bool]$Apply;changes=$changes} | ConvertTo-Json -Depth 4 -Compress
