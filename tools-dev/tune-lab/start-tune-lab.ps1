[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$labRoot = $PSScriptRoot
$nativeProject = Join-Path $labRoot 'native\AstralTuneLab.Capture.csproj'
$nativeDll = Join-Path $labRoot 'native\bin\Release\net10.0-windows\AstralTuneLab.Capture.dll'

Write-Host 'Validating Astral Tune Lab WASAPI helper...' -ForegroundColor Magenta
& dotnet build $nativeProject -c Release --no-restore --nologo
if ($LASTEXITCODE -ne 0) { throw "WASAPI helper build failed with exit code $LASTEXITCODE" }

Write-Host 'Starting Astral Tune Lab WASAPI helper...' -ForegroundColor Magenta
$env:ASTRAL_TUNE_LAB_SESSION_DIR = Join-Path $labRoot 'sessions'
$native = Start-Process -FilePath 'dotnet' -ArgumentList ('"' + $nativeDll + '"') -WorkingDirectory $labRoot -WindowStyle Hidden -PassThru

try {
    Write-Host 'Starting Tune Lab UI at http://127.0.0.1:4178' -ForegroundColor Magenta
    npm run dev --prefix $labRoot
} finally {
    if (-not $native.HasExited) { Stop-Process -Id $native.Id -Force }
}
