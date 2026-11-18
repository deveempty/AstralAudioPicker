param([string]$OutputDirectory = [Environment]::GetFolderPath('Desktop'), [string]$PickerDirectory = (Join-Path $env:ProgramFiles 'Astral Audio Switcher'))
$ErrorActionPreference = 'Stop'
# Read-only audio inspection. Only the diagnostic report directory is written.
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$reportDir = Join-Path $OutputDirectory ('Astral-Cosmic-Diagnostic-' + $stamp + '-' + [guid]::NewGuid().ToString('N').Substring(0,6))
New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
$failures = [Collections.Generic.List[object]]::new()
function Capture($name, [scriptblock]$action) {
 try { $result = & $action; ConvertTo-Json -InputObject $result -Depth 16 | Set-Content -LiteralPath (Join-Path $reportDir ($name+'.json')) -Encoding UTF8 }
 catch { $failures.Add(@{section=$name;error=$_.Exception.Message}) }
}
function RegistryValues($registryPath) {
 if(!(Test-Path -LiteralPath $registryPath)){return $null}
 $key=Get-Item -LiteralPath $registryPath; $values=@{}
 try { foreach($name in $key.GetValueNames()) { $values[$name]=@{kind=$key.GetValueKind($name).ToString();value=$key.GetValue($name,$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)} } }
 finally { $key.Dispose() }
 return $values
}
$control=Join-Path $env:ProgramData 'AstralAudio\Control'
$apo='C:\Program Files\EqualizerAPO'
try { $installed=(Get-ItemProperty 'HKLM:\SOFTWARE\EqualizerAPO').InstallPath; if($installed){$apo=$installed} } catch {}
Write-Host 'Deja el juego o musica reproduciendo. Recopilando sin cambiar el audio...'
Capture 'environment' {
 @{at=[DateTimeOffset]::Now.ToString('o');windows=[Environment]::OSVersion.VersionString;is64Bit=[Environment]::Is64BitProcess;admin=([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator);pickerVersion=(Get-Item -LiteralPath (Join-Path $PickerDirectory 'Astral Audio Switcher.exe')).VersionInfo.ProductVersion}
}
Capture 'services' { @(Get-Service audiosrv,AudioEndpointBuilder | Select-Object Name,@{n='status';e={$_.Status.ToString()}}) }
Capture 'cosmic-file' {
 $file=Join-Path $control 'Cosmic.dll';$item=Get-Item -LiteralPath $file
 @{bytes=$item.Length;modified=$item.LastWriteTimeUtc.ToString('o');sha256=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash}
}
Capture 'permissions' {
 @($control,(Join-Path $control 'Cosmic.dll'),(Join-Path $control 'v3'),(Join-Path $control 'v3\profile.json'),(Join-Path $control 'v3\instances')) | ForEach-Object {
  try { @{path=$_;sddl=(Get-Acl -LiteralPath $_).Sddl} } catch { @{path=$_;error=$_.Exception.Message} }
 }
}
Capture 'configuration' {
 $file=Join-Path $apo 'config\config.txt';$info=Get-Item -LiteralPath $file
 if($info.Length -gt 2MB){throw 'Config exceeds diagnostic size limit'}
 @{sha256=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash;lines=@(Get-Content -LiteralPath $file | Where-Object {$_ -match '^\s*(Device|Channel|VSTPlugin|Include|Preamp|Filter):'} | ForEach-Object { $_ -replace '\s+ChunkData\s+.*$',' [plugin state omitted]' })}
}
Capture 'apo-endpoints' {
 @(Get-ChildItem 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render' | ForEach-Object {
  $device=$_;$props=Get-ItemProperty -LiteralPath (Join-Path $device.PSPath 'Properties') -ErrorAction SilentlyContinue
  $adapter=$props.'{b3f8fa53-0004-438e-9003-51a46e139bfc},6'
  if($adapter -eq 'VB-Audio Virtual Cable'){
   @{id=$device.PSChildName;name=$props.'{a45c254e-df1c-4efd-8020-67d146a850e0},2';adapter=$adapter;state=$device.GetValue('DeviceState');fx=(RegistryValues (Join-Path $device.PSPath 'FxProperties'));child=(RegistryValues ('HKLM:\SOFTWARE\EqualizerAPO\Child APOs\'+$device.PSChildName))}
  }
 })
}
Capture 'audio-processes' {
 @(Get-Process audiodg -ErrorAction SilentlyContinue | ForEach-Object {
  $process=$_
  try { $modules=@($process.Modules);if(!$modules.Count){throw 'Windows did not expose process modules; run this collector as administrator'};@{pid=$process.Id;inspectedModuleCount=$modules.Count;modules=@($modules | Where-Object {$_.ModuleName -match '^(Cosmic|EqualizerAPO|WMALFXGFXDSP)\.dll$'} | Select-Object ModuleName,FileName)} }
  catch { @{pid=$process.Id;modulesUnavailable=$_.Exception.Message} }
 })
}
Capture 'effect-registration' {
 @('{EACD2258-FCAC-4FF4-B36D-419E924A6D79}','{EC1CC9CE-FAED-4822-828A-82A81A6F018F}','{62dc1a93-ae24-464c-a43e-452f824c4250}','{637c490d-eee3-4c0a-973f-371958802da2}') | ForEach-Object {
  @{id=$_;server=(RegistryValues ('HKLM:\SOFTWARE\Classes\CLSID\'+$_+'\InprocServer32'));audioEngineRegistered=(Test-Path -LiteralPath ('HKLM:\SOFTWARE\Classes\AudioEngine\AudioProcessingObjects\'+$_))}
 }
}
Capture 'profile' {
 $file=Join-Path $control 'v3\profile.json';if((Get-Item -LiteralPath $file).Length -gt 65536){throw 'Profile exceeds diagnostic size limit'}
 $profile=Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
 @{schema=$profile.schema;stateVersion=$profile.stateVersion;revision=$profile.revision;values=$profile.values}
}
$svcl=Join-Path $PickerDirectory 'resources\tools\svcl.exe'
for($sample=0;$sample -lt 3;$sample++){
 Capture ('heartbeat-'+$sample) {
  $now=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $files=@(Get-ChildItem -LiteralPath (Join-Path $control 'v3\instances') -Filter '*.json' -File)
  @{at=$now;totalFiles=$files.Count;instances=@($files | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 32 | ForEach-Object {
   try { if($_.Length -gt 8192){throw 'Heartbeat exceeds diagnostic size limit'};@{file=$_.Name;data=(Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json)} }
   catch { @{file=$_.Name;error=$_.Exception.Message} }
  })}
 }
 if(Test-Path -LiteralPath $svcl){
  try {
   $csv=Join-Path $reportDir ('audio-sessions-'+$sample+'.csv')
   $argsLine='/scomma "'+$csv+'" /Columns "Name,Type,Direction,Device Name,Default,Default Multimedia,Default Communications,Device State,Muted,Volume dB,Channels Count,Item ID,Process ID"'
   $job=Start-Process -FilePath $svcl -ArgumentList $argsLine -PassThru -WindowStyle Hidden
   if(!$job.WaitForExit(10000)){ $job.Kill();throw 'Audio session export timed out' }
   if(!(Test-Path -LiteralPath $csv)){throw 'Audio session export missing'}
  } catch {$failures.Add(@{section=('sessions-'+$sample);error=$_.Exception.Message})}
 } elseif($sample -eq 0){$failures.Add(@{section='sessions';error='Installed Picker audio inspection tool was not found'})}
 if($sample -lt 2){Start-Sleep -Milliseconds 700}
}
ConvertTo-Json -InputObject @($failures.ToArray()) -Depth 5 | Set-Content -LiteralPath (Join-Path $reportDir 'collection-errors.json') -Encoding UTF8
$archive=$reportDir+'.zip'
Compress-Archive -Path (Join-Path $reportDir '*') -DestinationPath $archive
Write-Host ('LISTO. Envia este archivo a soporte: '+$archive)
Write-Host 'No se cambio la salida, el volumen, el registro ni los servicios de audio. No se subio ningun archivo.'
