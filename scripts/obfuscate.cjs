const JavaScriptObfuscator = require('javascript-obfuscator')
const fs = require('node:fs')
const path = require('node:path')

const outputFiles = ['dist-electron/main.js', 'dist-electron/preload.js', 'dist-electron/preload.mjs']

for (const relativeFile of outputFiles) {
  const absoluteFile = path.join(__dirname, '..', relativeFile)
  if (!fs.existsSync(absoluteFile)) continue

  const source = fs.readFileSync(absoluteFile, 'utf8')
  const obfuscated = JavaScriptObfuscator.obfuscate(source, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.7,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.3,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    selfDefending: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.8,
    transformObjectKeys: true,
    unicodeEscapeSequence: false,
  }).getObfuscatedCode()

  fs.writeFileSync(absoluteFile, obfuscated, 'utf8')
  process.stdout.write(`Obfuscated: ${relativeFile}\n`)
}
