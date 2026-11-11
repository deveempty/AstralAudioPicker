param([string]$DatabaseId)
$ErrorActionPreference = 'Stop'
$workerRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\AstralAudio\cloudflare-worker'))
$workerSource = Join-Path $workerRoot 'src'
$entry = Join-Path $workerSource 'index.js'
if (!(Test-Path -LiteralPath $entry)) { throw 'Existing Audio Worker was not found.' }
if ($DatabaseId -and $DatabaseId -notmatch '^[a-f0-9-]{36}$') { throw 'Invalid D1 database ID.' }
$source = [IO.File]::ReadAllText($entry)
if (!$source.Contains("import {cosmicRequest} from './cosmic.js';")) { throw 'Unexpected Worker entry point; inspect it before integration.' }
if (!$source.Contains("import {communityRequest}")) {
  $source = "import {communityRequest} from './community.mjs';" + [Environment]::NewLine + $source
}
$route = "    if (cosmicPath.startsWith('/community/')) return communityRequest(request,env);"
if (!$source.Contains($route)) {
  $anchor = '    const cosmicPath = new URL(request.url).pathname;'
  if (!$source.Contains($anchor)) { throw 'Worker routing anchor was not found.' }
  $source = $source.Replace($anchor, $anchor + [Environment]::NewLine + $route)
}
$oldGuard = 'if (/cosmic/i.test(decoded))'
$newGuard = 'if (/(cosmic|community-private)/i.test(decoded))'
if (!$source.Contains($oldGuard) -and !$source.Contains($newGuard)) { throw 'Worker private-object guard was not found.' }
$source = $source.Replace($oldGuard,$newGuard)
$config = Join-Path $workerRoot 'wrangler.toml'
$configText = [IO.File]::ReadAllText($config)
if ($DatabaseId) {
  if ($configText -match 'binding\s*=\s*"COMMUNITY_DB"') { throw 'COMMUNITY_DB is already configured. Inspect the existing binding before changing it.' }
  $configText += [Environment]::NewLine + @"

[[d1_databases]]
binding = "COMMUNITY_DB"
database_name = "astral-audio-community"
database_id = "$DatabaseId"
migrations_dir = "migrations-community"
"@
}
$encoding = [Text.UTF8Encoding]::new($false)
$migrationDirectory = Join-Path $workerRoot 'migrations-community'
[IO.Directory]::CreateDirectory($migrationDirectory) | Out-Null
[IO.File]::WriteAllText((Join-Path $workerSource 'community.mjs'),[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'community.mjs')),$encoding)
[IO.File]::WriteAllText((Join-Path $migrationDirectory '0001_community.sql'),[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'migration.sql')),$encoding)
[IO.File]::WriteAllText((Join-Path $migrationDirectory '0002_applications.sql'),[IO.File]::ReadAllText((Join-Path $PSScriptRoot '0002_applications.sql')),$encoding)
[IO.File]::WriteAllText($entry,$source,$encoding)
if ($DatabaseId) { [IO.File]::WriteAllText($config,$configText,$encoding) }
Write-Output 'Community source integrated locally. No deployment or remote database changes were performed.'
