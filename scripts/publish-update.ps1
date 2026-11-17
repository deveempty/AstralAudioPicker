[CmdletBinding()]
param([switch]$ResumeCurrentVersion)

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
    # Windows PowerShell treats native stderr warnings as terminating errors
    # under Stop. Native success/failure must be determined by the exit code.
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & $Command
        $nativeExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousPreference
    }
    if ($nativeExitCode -ne 0) { throw "$Description failed with exit code $nativeExitCode." }
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

    $releaseType = if ($ResumeCurrentVersion) { $currentVersion } else { Get-NextVersion -CurrentVersion $currentVersion }
    $confirmation = (Read-Host "Build and publish '$releaseType' to the STABLE channel? Type YES").Trim()
    if ($confirmation -cne 'YES') {
        Write-Host 'Release cancelled. No files were changed.' -ForegroundColor Yellow
        exit 0
    }

    if (-not $ResumeCurrentVersion) {
        Invoke-NativeCommand 'Updating package version' {
            & npm.cmd version $releaseType --no-git-tag-version
        }
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
        # Publish immutable dependencies before announcing the Picker update.
        # Keep these objects: clients on earlier releases still pin their hashes.
        $audioRoot = Join-Path $projectRoot 'resources\audio-update'
        $audioManifest = Get-Content -LiteralPath (Join-Path $audioRoot 'manifest.json') -Raw | ConvertFrom-Json
        $audioObjects = @(
            @{ Name = 'mw4-content-v1.zip'; Hash = $audioManifest.archiveSha256; Size = $audioManifest.archiveBytes; Type = 'application/zip' },
            @{ Name = 'voicemeetersetup.exe'; Hash = $audioManifest.installerSha256; Size = $audioManifest.installerBytes; Type = 'application/vnd.microsoft.portable-executable' }
        )
        foreach ($asset in $audioObjects) {
            $assetPath = Join-Path $audioRoot $asset.Name
            if ((Get-FileHash -LiteralPath $assetPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $asset.Hash -or (Get-Item -LiteralPath $assetPath).Length -ne $asset.Size) { throw "Audio asset changed since validation: $($asset.Name)" }
            Invoke-NativeCommand "Uploading audio dependency $($asset.Name)" {
                & npx.cmd wrangler r2 object put "$bucketPrefix/content/$($asset.Hash)/$($asset.Name)" --file $assetPath --content-type $asset.Type --cache-control 'public, max-age=31536000, immutable' --remote --force
            }
        }
        Invoke-NativeCommand "Uploading $setupName" {
            & npx.cmd wrangler r2 object put "$bucketPrefix/$setupName" --file $setupPath --content-type 'application/vnd.microsoft.portable-executable' --cache-control 'public, max-age=31536000, immutable' --remote --force
        }
        Invoke-NativeCommand "Uploading $blockmapName" {
            & npx.cmd wrangler r2 object put "$bucketPrefix/$blockmapName" --file $blockmapPath --content-type 'application/octet-stream' --cache-control 'public, max-age=31536000, immutable' --remote --force
        }
        Invoke-NativeCommand 'Publishing latest.yml (clients can now see the update)' {
            & npx.cmd wrangler r2 object put "$bucketPrefix/latest.yml" --file $latestPath --content-type 'text/yaml' --cache-control 'no-cache, no-store, must-revalidate' --remote --force
        }

        # Retain current + two previous releases only after verifying the remote feed.
        & node (Join-Path $PSScriptRoot 'prune-picker-releases.mjs') --apply
        if ($LASTEXITCODE -ne 0) {
            Write-Warning 'Release published, but retention cleanup did not finish. Review it before the next release.'
        }
    }
    finally {
        Pop-Location
    }

    Write-Host "`nVersion $newVersion was published successfully." -ForegroundColor Green
    Write-Host "Channel: picker/stable"
    Write-Host "Retention policy: current version plus two previous versions; audio content is preserved."
}
catch {
    Write-Host "`nRelease stopped: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'latest.yml is uploaded last, so clients are not pointed at an incomplete release.' -ForegroundColor Yellow
    exit 1
}
finally {
    Pop-Location
}
