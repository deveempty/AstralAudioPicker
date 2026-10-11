# SetLoudness.ps1 - Enable/Disable Loudness Equalization and set Release Time
# Based on https://github.com/Falcosc/enable-loudness-equalisation

Param(
   [Parameter(Mandatory)]
   [string]$playbackDeviceName,
   
   [ValidateSet("enable", "disable", "setReleaseTime")]
   [string]$action = "enable",
   
   [ValidateRange(2, 7)]
   [int]$releaseTime = 4
)

$ErrorActionPreference = "Stop"
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
$regFile = "$env:temp\LoudnessSettings.reg"

$enhancementFlagKey = "{fc52a749-4be9-4510-896e-966ba6525980},3"
$releaseTimeKey = "{9c00eeed-edce-4cd8-ae08-cb05e8ef57a0},3"
$releaseTimeStr = $releaseTime.ToString().PadLeft(2,'0')

# Enable loudness: ff,ff | Disable: 00,00
if ($action -eq "disable") {
    $enableHex = "00,00"
} else {
    $enableHex = "ff,ff"
}

$fxPropertiesImport = @"
"{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},1"="{62dc1a93-ae24-464c-a43e-452f824c4250}"
"{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},2"="{637c490d-eee3-4c0a-973f-371958802da2}"
"{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},3"="{5860E1C5-F95C-4a7a-8EC8-8AEF24F379A1}"
"{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},5"="{62dc1a93-ae24-464c-a43e-452f824c4250}"
"{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},6"="{637c490d-eee3-4c0a-973f-371958802da2}"
"{fc52a749-4be9-4510-896e-966ba6525980},3"=hex:0b,00,00,00,01,00,00,00,$enableHex,00,00
"{9c00eeed-edce-4cd8-ae08-cb05e8ef57a0},3"=hex:03,00,00,00,01,00,00,00,$releaseTimeStr,00,00,00
"@

$devices = Get-ChildItem "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render\*\Properties"
if($devices.length -eq 0) {
    Write-Output "ERROR:NO_DEVICES"
    exit 1
}

$renderer = @()
foreach($device in $devices) {
    if (($device.GetValueNames() | ForEach-Object { $device.GetValue($_) }) -match $playbackDeviceName) {
        $renderer += Get-ItemProperty $device.PSParentPath
    }
}

if($renderer.length -lt 1) {
    Write-Output "ERROR:DEVICE_NOT_FOUND"
    exit 1
}

$activeRenderer = @($renderer | Where-Object -Property DeviceState -eq 1)
if($activeRenderer.length -lt 1) {
    Write-Output "ERROR:DEVICE_NOT_ACTIVE"
    exit 1
}

# Create reg file
"Windows Registry Editor Version 5.00" > $regFile
$activeRenderer | ForEach-Object {
    $fxKeyPath = Join-Path -Path $_.PSPath.Replace("Microsoft.PowerShell.Core\Registry::", "") -ChildPath FxProperties
    "[" + $fxKeyPath + "]" >> $regFile
    $fxPropertiesImport >> $regFile
}

# Check if running as admin
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    # Re-run as admin
    $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$($myInvocation.MyCommand.Definition)`" -playbackDeviceName `"$playbackDeviceName`" -action $action -releaseTime $releaseTime"
    Start-Process powershell -Verb runAs -ArgumentList $arguments -Wait
    Write-Output "OK"
    exit 0
}

# Import registry (running as admin)
$proc = Start-Process "$Env:SystemRoot\REGEDIT.exe" -ArgumentList '/s', $regFile -Wait -PassThru
if ($proc.ExitCode -ne 0) {
    Write-Output "ERROR:REG_IMPORT_FAILED"
    exit 1
}

# Restart audio service
Restart-Service audiosrv -Force
Write-Output "OK"

