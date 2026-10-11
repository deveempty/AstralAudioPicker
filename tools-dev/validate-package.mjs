import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const builderPath = path.join(projectRoot, 'electron-builder.json5')
const releaseRoot = path.join(projectRoot, 'release')
const requireArtifacts = process.argv.includes('--require-artifacts')
const errors = []
const warnings = []
const forbiddenSegments = new Set(['tools-dev', 'tests', 'audio-profile-schema', '.codex', 'reports', 'references'])
const forbiddenExtensions = new Set(['.py', '.pyc', '.md', '.env'])

function walk(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(target) : [target]
  })
}

const builder = JSON.parse(fs.readFileSync(builderPath, 'utf8'))
const packagedRoots = builder.files
if (JSON.stringify(packagedRoots) !== JSON.stringify(['dist', 'dist-electron'])) errors.push('electron-builder files must remain restricted to dist and dist-electron')

for (const resource of builder.extraResources || []) {
  const normalized = String(resource.from || '').replaceAll('\\', '/').toLowerCase()
  if (!['electron/scripts', 'electron/tools'].includes(normalized)) errors.push(`Unexpected extraResources source: ${resource.from}`)
}

for (const rootName of ['dist', 'dist-electron']) {
  const root = path.join(projectRoot, rootName)
  if (!fs.existsSync(root)) { warnings.push(`${rootName} does not exist yet; source allowlist was still checked`); continue }
  for (const file of walk(root)) {
    const relative = path.relative(root, file).replaceAll('\\', '/')
    const segments = relative.toLowerCase().split('/')
    if (segments.some(segment => forbiddenSegments.has(segment))) errors.push(`${rootName}/${relative}: forbidden development directory`)
    if (forbiddenExtensions.has(path.extname(file).toLowerCase())) errors.push(`${rootName}/${relative}: forbidden development file type`)
  }
}

const unpackedResources = path.join(releaseRoot, 'win-unpacked', 'resources')
if (fs.existsSync(unpackedResources)) {
  for (const file of walk(unpackedResources)) {
    const relative = path.relative(unpackedResources, file).replaceAll('\\', '/')
    const segments = relative.toLowerCase().split('/')
    if (segments.some(segment => forbiddenSegments.has(segment))) errors.push(`win-unpacked/resources/${relative}: forbidden development directory`)
    if (forbiddenExtensions.has(path.extname(file).toLowerCase())) errors.push(`win-unpacked/resources/${relative}: forbidden development file type`)
  }
} else if (requireArtifacts) {
  warnings.push('win-unpacked resources are unavailable; validating NSIS artifacts and builder allowlist only')
}

if (requireArtifacts) {
  const packageVersion = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')).version
  for (const name of [`Astral-Audio-Picker-Setup-${packageVersion}.exe`, `Astral-Audio-Picker-Setup-${packageVersion}.exe.blockmap`, 'latest.yml']) {
    const artifact = path.join(releaseRoot, name)
    if (!fs.existsSync(artifact) || fs.statSync(artifact).size === 0) errors.push(`Missing or empty release artifact: ${name}`)
  }
}

warnings.forEach(message => console.warn(`WARN  ${message}`))
errors.forEach(message => console.error(`ERROR ${message}`))
if (errors.length) {
  console.error(`Package validation failed with ${errors.length} error(s).`)
  process.exit(1)
}
console.log(`Package validation passed with ${warnings.length} warning(s). Development tools are excluded.`)
