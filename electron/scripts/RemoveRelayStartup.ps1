param([Parameter(Mandatory=$true)][string]$AppExecutable)
$ErrorActionPreference='Stop'
$root=Join-Path $env:LOCALAPPDATA 'AstralAudio\upgrade-v1'
$engineFile=Join-Path $root 'engine.json'
$journal=Join-Path $root 'startup\journal.json'
if((Test-Path $engineFile) -and (Test-Path $journal)){
 # Restore exact backed-up entries, without overwriting newer user entries.
 $engine=Get-Content -LiteralPath $engineFile -Raw | ConvertFrom-Json
 & (Join-Path $PSScriptRoot 'RelayStartup.ps1') -Mode Restore -EnginePath $engine.path -JournalPath $journal
}
foreach($task in Get-ScheduledTask -TaskName 'AstralAudio-Startup-*' -ErrorAction SilentlyContinue){
 if($task.Actions.Count -eq 1 -and $task.Actions[0].Execute -eq $AppExecutable -and $task.Actions[0].Arguments -eq '--audio-background'){
  Unregister-ScheduledTask -TaskName $task.TaskName -TaskPath $task.TaskPath -Confirm:$false
 }
}
foreach($name in @('relay-complete.json','startup-before.json')){Remove-Item -LiteralPath (Join-Path $root $name) -Force -ErrorAction SilentlyContinue}
# Keep content, settings and recovery backups; only startup ownership is removed.
