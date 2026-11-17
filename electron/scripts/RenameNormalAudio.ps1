param([switch]$Apply)
$ErrorActionPreference='Stop'
$nameKey='{a45c254e-df1c-4efd-8020-67d146a850e0},2'
$adapterKey='{b3f8fa53-0004-438e-9003-51a46e139bfc},6'
$root='SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render'
$changes=@()
foreach($endpoint in Get-ChildItem "Registry::HKEY_LOCAL_MACHINE\$root"){
 $props=Get-ItemProperty -LiteralPath (Join-Path $endpoint.PSPath 'Properties')
 if([string]$props.$nameKey -eq 'Voicemeeter Input' -and [string]$props.$adapterKey -eq 'VB-Audio Voicemeeter VAIO'){
  $changes+=@{id=$endpoint.PSChildName;previous=[string]$props.$nameKey;target='Audio Normal';key="$root\$($endpoint.PSChildName)\Properties"}
 }
}
if($Apply -and $changes.Count){
 $backup=Join-Path $env:ProgramData 'AstralAudio\icons\backups'
 New-Item -ItemType Directory -Path $backup -Force | Out-Null
 $changes | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $backup ('normal-audio-'+[guid]::NewGuid().ToString()+'.json')) -Encoding UTF8
 foreach($change in $changes){
  $key=$null
  try{
   $key=[Microsoft.Win32.Registry]::LocalMachine.OpenSubKey($change.key,[Microsoft.Win32.RegistryKeyPermissionCheck]::ReadWriteSubTree,[System.Security.AccessControl.RegistryRights]::SetValue)
   if($null -eq $key){throw 'Endpoint disappeared'}
   $key.SetValue($nameKey,'Audio Normal',[Microsoft.Win32.RegistryValueKind]::String)
  }finally{if($null -ne $key){$key.Dispose()}}
  if((Get-ItemProperty -LiteralPath ('Registry::HKEY_LOCAL_MACHINE\'+$change.key)).$nameKey -ne 'Audio Normal'){throw 'Endpoint name readback mismatch'}
 }
}
@{applied=[bool]$Apply;changes=$changes} | ConvertTo-Json -Depth 4 -Compress
