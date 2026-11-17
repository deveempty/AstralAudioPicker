const assert=require('node:assert/strict'),fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),vm=require('node:vm'),esbuild=require('esbuild');
const root=fs.mkdtempSync(path.resolve('output/post-update-test-'));
function load(file,mocks={}){const mod={exports:{}};vm.runInNewContext(esbuild.transformSync(fs.readFileSync(file,'utf8'),{loader:'ts',format:'cjs',target:'node18'}).code,{module:mod,exports:mod.exports,require:id=>id in mocks?mocks[id]:require(id),process,console,Buffer,setTimeout,clearTimeout});return mod.exports}
const shared=load('shared/post-update.ts'),{createPostUpdate}=load('electron/post-update.ts',{'../shared/post-update':shared});
const {commitEqFiles}=load('electron/eq-transaction.ts');
const {acquireCosmicLock}=load('electron/cosmic-lock.ts');
const eq=(source='Filk/Headphone.txt')=>Buffer.from(`# Source file: ${source}\n# Target: BO7 Target V5\nPreamp: -3.0 dB\n`+Array.from({length:10},(_,i)=>`Filter ${i+1}: ON PK Fc 100 Hz Gain 1.0 dB Q 1.0`).join('\n'));
(async()=>{
 let calls=[],fail='apo';const actions=Object.fromEntries(shared.preparationSteps.map(step=>[step,async()=>{calls.push(step);if(step===fail)throw Error('APO_CHAIN_UNCONFIRMED')}]))
 const fresh=createPostUpdate(path.join(root,'fresh'),'4.0.0',async()=>false,actions);assert.equal((await fresh.start()).phase,'ready');assert.equal(calls.length,0,'fresh install must not migrate old settings');
 const updated=createPostUpdate(path.join(root,'fresh'),'4.0.1',async()=>false,actions);assert.equal((await updated.start()).phase,'error');assert.equal(updated.status().step,'apo');assert(!calls.includes('loudness'),'APO failure must prevent LEQ mutation');
 fail='';calls=[];assert.equal((await updated.start()).phase,'ready');assert.equal(calls.at(-1),'verify');calls=[];await updated.start();assert.equal(calls.length,0,'successful same-version migration must not repeat');
 const interrupted=path.join(root,'interrupted');fs.mkdirSync(interrupted);fs.writeFileSync(path.join(interrupted,'post-update.json'),JSON.stringify({phase:'running',version:'4.0.0',step:'loudness',completed:['snapshot','content','headphones','apo']}));
 const resumed=createPostUpdate(interrupted,'4.0.0',async()=>true,actions);assert.equal((await resumed.start()).phase,'ready');assert(calls.includes('apo'),'retry revalidates prerequisites');
 let release;const held=new Promise(r=>release=r);const dedup=createPostUpdate(path.join(root,'dedup'),'4.0.0',async()=>true,{...actions,snapshot:async()=>held});const one=dedup.start(),two=dedup.start();assert.equal(one,two);release();await one;
 const files=path.join(root,'eq'),journal=path.join(root,'eq-journal');fs.mkdirSync(files);const target=path.join(files,'selected.txt'),other=path.join(files,'other.txt');fs.writeFileSync(target,'old eq');fs.writeFileSync(other,'untouched');
 commitEqFiles([{target,data:eq()}],files,journal);assert.equal(fs.readFileSync(target,'utf8'),eq().toString());assert.equal(fs.readFileSync(other,'utf8'),'untouched');
 assert.throws(()=>commitEqFiles([{target,data:Buffer.from('NaN')}],files,journal),/OUTPUT_INVALID/);assert.equal(fs.readFileSync(target,'utf8'),eq().toString());
 // Simulate process death after a replace and before commit. Next operation restores it.
 const backup=path.join(journal,'crash.backup');fs.writeFileSync(backup,'pre-crash');fs.writeFileSync(target,'partial');fs.writeFileSync(path.join(journal,'transaction.json'),JSON.stringify({completed:false,records:[{target,backup,hash:'unused'}]}));
 assert.throws(()=>commitEqFiles([{target,data:Buffer.from('NaN')}],files,journal),/OUTPUT_INVALID/);assert.equal(fs.readFileSync(target,'utf8'),'pre-crash');
 const lock=path.join(root,'cosmic.lock');const unlock=await acquireCosmicLock(lock);await assert.rejects(acquireCosmicLock(lock),/COSMIC_INSTALL_BUSY/);await unlock();assert(!fs.existsSync(lock));
 fs.writeFileSync(lock,'');await assert.rejects(acquireCosmicLock(lock),/COSMIC_LOCK_RECOVERY_REQUIRED/);assert(fs.existsSync(lock),'never remove an unowned legacy lock');fs.unlinkSync(lock);
 // A process that definitely exited owns this stale lock.
 const child=require('node:child_process').spawnSync(process.execPath,['-e','process.exit(0)']);fs.writeFileSync(lock,JSON.stringify({pid:child.pid,token:'dead-owner'}));const recovered=await acquireCosmicLock(lock);await recovered();assert(!fs.existsSync(lock));
 console.log('PASS: fresh/update distinction, versioned migration, failure gating, interrupted retry, single flight, transactional EQ validation/recovery, preservation of other files, live/legacy/dead Cosmic locks. All mutations isolated in output/.');
})().catch(e=>{console.error(e);process.exitCode=1});
