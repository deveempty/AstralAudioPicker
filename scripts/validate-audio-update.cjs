const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../resources/audio-update'),manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const hash=name=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex');
assert.equal(manifest.id,'mw4-content-v1');assert.equal(fs.statSync(path.join(root,'mw4-content-v1.zip')).size,manifest.archiveBytes);assert.equal(fs.statSync(path.join(root,'voicemeetersetup.exe')).size,manifest.installerBytes);assert.equal(hash('mw4-content-v1.zip'),manifest.archiveSha256);assert.equal(hash('voicemeetersetup.exe'),manifest.installerSha256);
const names=new Set();for(const file of manifest.files){assert(/^(presets|charlie|measurements|targets|reference-eq)\//.test(file.path));assert(!file.path.split('/').some(p=>!p||p==='.'||p==='..'||/[\\:]/.test(p)));assert(!names.has(file.path.toLowerCase()));names.add(file.path.toLowerCase());assert(/^[a-f0-9]{64}$/.test(file.sha256));assert(Number.isSafeInteger(file.bytes)&&file.bytes>=0)}
assert.equal(manifest.files.filter(f=>f.path.startsWith('presets/')).length,60);
for(const name of ['charlie/atk_spatial_engine_charlie_v1_1_0.dll','targets/Target/Target_V5_MW4.txt','measurements/database.json'])assert(names.has(name.toLowerCase()),'Missing '+name);
console.log('Audio update payload validated: '+manifest.files.length+' files, archive and installer hashes match.');
