[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$workerRoot = Join-Path (Split-Path -Parent $projectRoot) 'AstralAudio\cloudflare-worker'
$releaseRoot = Join-Path $projectRoot 'release'
$bucketPrefix = 'astral-audio/picker/stable'

function Invoke-NativeCommand {
    param(
        [Parameter(Mandatory)] [string] $Description,
        [Parameter(Mandatory)] [scriptblock] $Command
    )

    Write-Host "`n==> $Description" -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Description failed with exit code $LASTEXITCODE."
    }
}

function Remove-PreviousR2Artifact {
    param([Parameter(Mandatory)] [string] $ObjectPath)

    Write-Host "`n==> Removing previous R2 artifact: $ObjectPath" -ForegroundColor Cyan
    & npx.cmd wrangler r2 object delete $ObjectPath --remote --force
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Warning: the new release is published, but the previous artifact could not be removed: $ObjectPath" -ForegroundColor Yellow
    }
}

function Get-NextVersion {
    param([Parameter(Mandatory)] [string] $CurrentVersion)

    Write-Host "`nCurrent version: $CurrentVersion" -ForegroundColor Yellow
    Write-Host '  1) Patch  - bug fix        (2.1.1 -> 2.1.2)'
    Write-Host '  2) Minor  - new feature    (2.1.1 -> 2.2.0)'
    Write-Host '  3) Major  - breaking change (2.1.1 -> 3.0.0)'
    Write-Host '  4) Custom version'
    Write-Host '  Q) Cancel'

    $choice = (Read-Host 'Select release type').Trim().ToLowerInvariant()
    switch ($choice) {
        '1' { return 'patch' }
        'patch' { return 'patch' }
        '2' { return 'minor' }
        'minor' { return 'minor' }
        '3' { return 'major' }
        'major' { return 'major' }
        '4' {
            $custom = (Read-Host 'Enter version (example: 2.3.0)').Trim()
            if ($custom -notmatch '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$') {
                throw "Invalid semantic version: $custom"
            }
            return $custom
        }
        'q' { exit 0 }
        'quit' { exit 0 }
        default { throw "Unknown release type: $choice" }
    }
}

Push-Location $projectRoot
try {
    $currentVersion = (& node -p "require('./package.json').version").Trim()
    if ($LASTEXITCODE -ne 0 -or -not $currentVersion) {
        throw 'Could not read the current package version.'
    }

    $releaseType = Get-NextVersion -CurrentVersion $currentVersion
    $confirmation = (Read-Host "Build and publish '$releaseType' to the STABLE channel? Type YES").Trim()
    if ($confirmation -cne 'YES') {
        Write-Host 'Release cancelled. No files were changed.' -ForegroundColor Yellow
        exit 0
    }

    Invoke-NativeCommand 'Updating package version' {
        & npm.cmd version $releaseType --no-git-tag-version
    }

    $newVersion = (& node -p "require('./package.json').version").Trim()
    if ($LASTEXITCODE -ne 0 -or -not $newVersion) {
        throw 'Could not read the new package version.'
    }

    Invoke-NativeCommand "Building and obfuscating version $newVersion" {
        & npm.cmd run build
    }

    Invoke-NativeCommand 'Verifying release contents and excluding development tools' {
        & node tools-dev/validate-package.mjs --require-artifacts
    }

    $setupName = "Astral-Audio-Picker-Setup-$newVersion.exe"
    $blockmapName = "$setupName.blockmap"
    $setupPath = Join-Path $releaseRoot $setupName
    $blockmapPath = Join-Path $releaseRoot $blockmapName
    $latestPath = Join-Path $releaseRoot 'latest.yml'

    foreach ($artifact in @($setupPath, $blockmapPath, $latestPath)) {
        if (-not (Test-Path -LiteralPath $artifact -PathType Leaf)) {
            throw "Expected build artifact was not created: $artifact"
        }
        if ((Get-Item -LiteralPath $artifact).Length -eq 0) {
            throw "Build artifact is empty: $artifact"
        }
    }

    $latestContent = Get-Content -LiteralPath $latestPath -Raw
    if ($latestContent -notmatch [regex]::Escape($setupName) -or $latestContent -notmatch "(?m)^version:\s*$([regex]::Escape($newVersion))\s*$") {
        throw 'latest.yml does not match the new version and installer. Nothing was uploaded.'
    }

    if (-not (Test-Path -LiteralPath $workerRoot -PathType Container)) {
        throw "Cloudflare Worker directory was not found: $workerRoot"
    }

    Push-Location $workerRoot
    try {
        Invoke-NativeCommand "Uploading $setupName" {
            & npx.cmd wrangler r2 object put "$bucketPrefix/$setupName" --file $setupPath --content-type 'application/vnd.microsoft.portable-executable' --cache-control 'public, max-age=31536000, immutable' --remote --force
        }
        Invoke-NativeCommand "Uploading $blockmapName" {
            & npx.cmd wrangler r2 object put "$bucketPrefix/$blockmapName" --file $blockmapPath --content-type 'application/octet-stream' --cache-control 'public, max-age=31536000, immutable' --remote --force
        }
        Invoke-NativeCommand 'Publishing latest.yml (clients can now see the update)' {
            & npx.cmd wrangler r2 object put "$bucketPrefix/latest.yml" --file $latestPath --content-type 'text/yaml' --cache-control 'no-cache, no-store, must-revalidate' --remote --force
        }

        $previousSetupName = "Astral-Audio-Picker-Setup-$currentVersion.exe"
        Remove-PreviousR2Artifact -ObjectPath "$bucketPrefix/$previousSetupName"
        Remove-PreviousR2Artifact -ObjectPath "$bucketPrefix/$previousSetupName.blockmap"
    }
    finally {
        Pop-Location
    }

    Write-Host "`nVersion $newVersion was published successfully." -ForegroundColor Green
    Write-Host "Channel: picker/stable"
    Write-Host "Previous R2 artifacts for version $currentVersion were removed."
}
catch {
    Write-Host "`nRelease stopped: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'latest.yml is uploaded last, so clients are not pointed at an incomplete release.' -ForegroundColor Yellow
    exit 1
}
finally {
    Pop-Location
}
