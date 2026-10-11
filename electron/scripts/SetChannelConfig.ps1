# SetChannelConfig.ps1 - Set audio device channel configuration (Stereo/7.1)
# For Cable Input 7.1 (VB-Audio)

Param(
   [Parameter(Mandatory)]
   [string]$playbackDeviceName,

   [Parameter(Mandatory)]
   [ValidateSet("stereo", "7.1")]
   [string]$channelConfig
)

$ErrorActionPreference = "Stop"
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
$regFile = "$env:temp\ChannelConfig.reg"

# Speaker configuration property key
# {1da5d803-d492-4edd-8c23-e0c0ffee7f0e},3 = PKEY_AudioEndpoint_PhysicalSpeakers
$speakerConfigKey = "{1da5d803-d492-4edd-8c23-e0c0ffee7f0e},3"

# Speaker configuration values (DWORD):
# Stereo = 3 (KSAUDIO_SPEAKER_STEREO)
# 7.1 = 1599 (0x63f) (KSAUDIO_SPEAKER_7POINT1_SURROUND)
if ($channelConfig -eq "stereo") {
    $speakerValue = "dword:00000003"
} else {
    $speakerValue = "dword:0000063f"
}

# Find the device in registry
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
    $propsPath = $_.PSPath.Replace("Microsoft.PowerShell.Core\Registry::", "") + "\Properties"
    "[" + $propsPath + "]" >> $regFile
    "`"$speakerConfigKey`"=$speakerValue" >> $regFile
}

# Check if running as admin
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    # Re-run as admin
    $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$($myInvocation.MyCommand.Definition)`" -playbackDeviceName `"$playbackDeviceName`" -channelConfig $channelConfig"
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

# Restart audio service to apply
Restart-Service audiosrv -Force

Write-Output "OK"
