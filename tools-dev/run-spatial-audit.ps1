[CmdletBinding()]
param(
    [string] $Game = 'call_of_duty_warzone',
    [string] $Headphones = 'generic_iem'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $PSScriptRoot '.runtime'
$uv = Join-Path $runtimeRoot 'uv\uv.exe'
$upstream = Join-Path $PSScriptRoot 'vendor\game-3d-audio-spatial-config-agent-skill'
$reports = Join-Path $PSScriptRoot 'reports'

if (-not (Test-Path -LiteralPath $uv -PathType Leaf)) {
    throw 'Local uv runtime is missing. Restore tools-dev/.runtime/uv before running the spatial audit.'
}
if (-not (Test-Path -LiteralPath $upstream -PathType Container)) {
    throw 'The vendored spatial-audio repository is missing.'
}

New-Item -ItemType Directory -Path $reports -Force | Out-Null
$env:UV_CACHE_DIR = Join-Path $runtimeRoot 'cache'
$env:UV_PYTHON_INSTALL_DIR = Join-Path $runtimeRoot 'python'
$env:PYTHONPATH = Join-Path $upstream 'src'

Write-Host '==> Running upstream engine/profile tests' -ForegroundColor Cyan
& $uv run --offline --no-project --python 3.12 --with pytest python -m pytest `
    (Join-Path $upstream 'tests\test_engine.py') `
    (Join-Path $upstream 'tests\test_profiles.py') `
    -q -p no:cacheprovider -o 'addopts='
if ($LASTEXITCODE -ne 0) { throw "Upstream tests failed with exit code $LASTEXITCODE" }

$safeGame = $Game -replace '[^a-zA-Z0-9_-]', '_'
$safeHeadphones = $Headphones -replace '[^a-zA-Z0-9_-]', '_'
$report = Join-Path $reports "upstream-$safeGame-$safeHeadphones.json"

Write-Host '==> Generating isolated spatial-audio report' -ForegroundColor Cyan
& $uv run --offline --no-project --python 3.12 python -m game_audio_spatial analyze `
    --game $Game --headphones $Headphones --output $report
if ($LASTEXITCODE -ne 0) { throw "Report generation failed with exit code $LASTEXITCODE" }

Write-Host "Spatial audit passed. Report: $report" -ForegroundColor Green
