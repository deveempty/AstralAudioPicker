const fs=require('node:fs/promises'),sync=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),cp=require('node:child_process'),esbuild=require('esbuild');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
esbuild.buildSync({entryPoints:['electron/audio-content.ts'],bundle:true,platform:'node',format:'cjs',outfile:'output/audio-content-test.cjs'});
const {applyContentFiles,contentDestination}=require('../output/audio-content-test.cjs');
(async()=>{
 const base=await fs.mkdtemp(path.resolve('output/content-lab-')),stage=path.join(base,'stage');await fs.mkdir(stage);
 const packageRoot=path.resolve('resources/audio-update'),manifest=JSON.parse(await fs.readFile(path.join(packageRoot,'manifest.json'),'utf8'));
 assert.equal(hash(await fs.readFile(path.join(packageRoot,'mw4-content-v1.zip'))),manifest.archiveSha256);
 assert.equal(hash(await fs.readFile(path.join(packageRoot,'voicemeetersetup.exe'))),manifest.installerSha256);
 cp.execFileSync('tar.exe',['-xf',path.join(packageRoot,'mw4-content-v1.zip'),'-C',stage],{windowsHide:true});
 const roots=Object.fromEntries(['presets','charlie','measurements','targets','reference-eq'].map(k=>[k,path.join(base,'installed',k)]));
 const sentinel=path.join(base,'installed','config.txt');await fs.mkdir(path.dirname(sentinel),{recursive:true});await fs.writeFile(sentinel,'User configuration stays intact');
 assert.throws(()=>contentDestination('presets/../config.txt',roots));assert.throws(()=>contentDestination('charlie/other.dll',roots));
 console.log('Applying full manifest in isolated lab...');
 assert.equal(await applyContentFiles(stage,manifest,roots,path.join(base,'backup')),manifest.files.length);
 assert.equal(await fs.readFile(sentinel,'utf8'),'User configuration stays intact');
 assert.equal(await applyContentFiles(stage,manifest,roots,path.join(base,'repeat-backup')),0);
 await assert.rejects(applyContentFiles(stage,{...manifest,files:[{...manifest.files[0],sha256:'bad'}]},roots,path.join(base,'invalid')),/HASH_MISMATCH/);
 // Force a failure after the first write; the old content must be restored.
 const small=path.join(base,'small');await fs.mkdir(path.join(small,'targets'),{recursive:true});await fs.writeFile(path.join(small,'targets','a.txt'),'new');await fs.writeFile(path.join(small,'targets','b.txt'),'new');
 const target=path.join(base,'rollback');await fs.mkdir(path.join(target,'b.txt'),{recursive:true});await fs.writeFile(path.join(target,'a.txt'),'original');
 const files=['a.txt','b.txt'].map(n=>({path:'targets/'+n,bytes:3,sha256:hash(Buffer.from('new'))}));
 await assert.rejects(applyContentFiles(small,{...manifest,files},{targets:target},path.join(base,'rollback-backup')));
 assert.equal(await fs.readFile(path.join(target,'a.txt'),'utf8'),'original');
 console.log(`PASS: ${manifest.files.length} packaged files verified and installed in lab, repeat is a no-op, configuration preserved, hash rejection, path rejection and rollback. Lab: ${base}`);
})().catch(e=>{console.error(e);process.exitCode=1});
