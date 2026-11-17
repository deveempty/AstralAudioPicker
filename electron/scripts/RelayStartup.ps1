param([Parameter(Mandatory=$true)][string]$EnginePath,[Parameter(Mandatory=$true)][string]$JournalPath,[ValidateSet('Inspect','Retire','Restore')][string]$Mode='Inspect')
$ErrorActionPreference='Stop'
$engine=[IO.Path]::GetFullPath($EnginePath)
function Matches([string]$command){
 $candidate=if($command -match '^\s*"([^"]+\.exe)"'){$matches[1]}elseif($command -match '^\s*(.+?\.exe)(?:\s|$)'){$matches[1]}else{''}
 return $candidate -and [Environment]::ExpandEnvironmentVariables($candidate).Equals($engine,[StringComparison]::OrdinalIgnoreCase)
}
if($Mode -eq 'Restore'){
 if(-not(Test-Path -LiteralPath $JournalPath)){return}
 $journal=Get-Content -LiteralPath $JournalPath -Raw | ConvertFrom-Json
 foreach($entry in $journal.entries){
  if($entry.kind -eq 'shortcut'){
   if([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($entry.path)) -ne [Environment]::GetFolderPath('Startup') -or [IO.Path]::GetExtension($entry.path) -ne '.lnk'){throw 'RELAY_UNSAFE_RESTORE'}
   if([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($entry.backup)) -ne [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($JournalPath))){throw 'RELAY_UNSAFE_BACKUP'}
   if(-not(Test-Path -LiteralPath $entry.path)){Copy-Item -LiteralPath $entry.backup -Destination $entry.path}
  }
  elseif($entry.kind -eq 'run'){
   if($entry.path -ne 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -or -not(Matches $entry.value)){throw 'RELAY_UNSAFE_RESTORE'}
   $current=Get-ItemProperty -LiteralPath $entry.path
   if($null -eq $current.($entry.name)){New-ItemProperty -LiteralPath $entry.path -Name $entry.name -Value $entry.value -PropertyType $entry.type -Force | Out-Null}
  }
 }
 return
}
$entries=@();$ws=New-Object -ComObject WScript.Shell
$run='HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
if(Test-Path -LiteralPath $run){$key=Get-Item $run;foreach($name in $key.GetValueNames()){$value=$key.GetValue($name);if($value -is [string] -and (Matches $value)){$entries+=@{kind='run';path=$run;name=$name;value=$value;type=[string]$key.GetValueKind($name)}}}}
$startup=[Environment]::GetFolderPath('Startup')
foreach($file in Get-ChildItem -LiteralPath $startup -Filter '*.lnk' -ErrorAction Stop){if((Matches ('"'+$ws.CreateShortcut($file.FullName).TargetPath+'"'))){$entries+=@{kind='shortcut';path=$file.FullName;backup=(Join-Path (Split-Path $JournalPath) ($file.Name+'.backup'))}}}
# Do not change machine-wide or scheduled startup ownership implicitly.
$conflicts=@()
foreach($root in @('HKLM:\Software\Microsoft\Windows\CurrentVersion\Run','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run')){if(Test-Path $root){$key=Get-Item $root;foreach($name in $key.GetValueNames()){if(Matches ([string]$key.GetValue($name))){$conflicts+=$root+'\'+$name}}}}
foreach($file in Get-ChildItem -LiteralPath ([Environment]::GetFolderPath('CommonStartup')) -Filter '*.lnk'){if(Matches ('"'+$ws.CreateShortcut($file.FullName).TargetPath+'"')){$conflicts+=$file.FullName}}
foreach($task in Get-ScheduledTask){foreach($action in $task.Actions){if(Matches ('"'+$action.Execute+'"')){if($task.State -ne 'Disabled'){$conflicts+=$task.TaskPath+$task.TaskName}}}}
if($Mode -eq 'Inspect'){@{entries=$entries;conflicts=$conflicts}|ConvertTo-Json -Depth 5 -Compress;return}
if($conflicts.Count){throw 'RELAY_STARTUP_CONFLICT'}
if(Test-Path -LiteralPath $JournalPath){throw 'RELAY_JOURNAL_EXISTS'}
New-Item -ItemType Directory -Path (Split-Path $JournalPath) -Force | Out-Null
foreach($entry in $entries){if($entry.kind -eq 'shortcut'){Copy-Item -LiteralPath $entry.path -Destination $entry.backup; if((Get-FileHash $entry.path).Hash -ne (Get-FileHash $entry.backup).Hash){throw 'RELAY_BACKUP_FAILED'}}}
@{entries=$entries} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $JournalPath -Encoding UTF8
foreach($entry in $entries){
 if($entry.kind -eq 'shortcut'){Remove-Item -LiteralPath $entry.path}
 else{Remove-ItemProperty -LiteralPath $entry.path -Name $entry.name}
}
