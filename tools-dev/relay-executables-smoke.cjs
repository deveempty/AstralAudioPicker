const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
esbuild.buildSync({entryPoints:['electron/relay-executables.ts'],bundle:true,platform:'node',format:'cjs',outfile:'output/relay-executables-test.cjs'});
const {relayExecutables}=require('../output/relay-executables-test.cjs');
const base=fs.mkdtempSync(path.resolve('output/relay-executables-'));
for(const [index,name] of ['voicemeeter','voicemeeterpro','voicemeeter8'].entries()){
 const folder=path.join(base,String(index));fs.mkdirSync(folder);
 assert.deepEqual(relayExecutables(folder),[]);
 const x64=path.join(folder,name+'_x64.exe');fs.writeFileSync(x64,'fixture');
 assert.deepEqual(relayExecutables(folder),[{edition:index+1,path:x64}]);
 const legacy=path.join(folder,name+'.exe');fs.writeFileSync(legacy,'fixture');
 assert.deepEqual(relayExecutables(folder),[{edition:index+1,path:legacy}]);
}
const unrelated=path.join(base,'unrelated');fs.mkdirSync(unrelated);
fs.mkdirSync(path.join(unrelated,'voicemeeter.exe'));
fs.writeFileSync(path.join(unrelated,'VoicemeeterMacroButtons.exe'),'fixture');
assert.deepEqual(relayExecutables(unrelated),[]);
console.log('PASS: all three editions, x64-only installations, deduplication, legacy preference and exclusion of directories/helper executables. No engines launched.');
