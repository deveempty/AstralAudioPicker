const fs=require('fs/promises'),path=require('path'),os=require('os'),assert=require('assert/strict'),esbuild=require('esbuild');
(async()=>{
 await esbuild.build({entryPoints:['electron/loudness16.ts'],bundle:true,platform:'node',outfile:'output/loudness16-test.cjs'});
 await esbuild.build({entryPoints:['electron/loudness-migration.ts'],bundle:true,platform:'node',outfile:'output/loudness-migration-test.cjs'});
 const {decodeLoudness16}=require('../output/loudness16-test.cjs');const {ensureLoudness16Enabled}=require('../output/loudness-migration-test.cjs');
 const deviceId='{00000000-0000-0000-0000-000000000016}',flag='{fc52a749-4be9-4510-896e-966ba6525980}',release='{9c00eeed-edce-4cd8-ae08-cb05e8ef57a0}';
 for(const suffix of [0,3,1599]){
  const properties={[`${flag},${suffix}`]:[11,0,0,0,1,0,0,0,255,255,0,0],[`${release},${suffix}`]:[3,0,0,0,1,0,0,0,7,0,0,0]};
  assert.deepEqual(decodeLoudness16({deviceId,properties}),{deviceId,enabled:true,releaseTime:100});
  properties['{1da5d803-d492-4edd-8c23-e0c0ffee7f0e},5']=1;assert.equal(decodeLoudness16({deviceId,properties}).enabled,false);
 }
 assert.equal(decodeLoudness16({deviceId,properties:{}}).enabled,false);
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'astral-loudness-test-'));
 try{
  let state={deviceId,enabled:false,releaseTime:80},writes=0;
  const read=async()=>({...state}),enable=async()=>{writes++;state.enabled=true;return read()};
  await ensureLoudness16Enabled(directory,read,enable);assert.equal(writes,1);assert.equal(state.releaseTime,80);
  state.enabled=false;await ensureLoudness16Enabled(directory,read,enable);assert.equal(writes,1,'Later user disabling is preserved');
  const faildir=path.join(directory,'retry');state.enabled=false;
  await assert.rejects(ensureLoudness16Enabled(faildir,read,async()=>{state.enabled=true;throw Error('relay restart failed')}));
  await assert.rejects(fs.access(path.join(faildir,'loudness16-enabled-v1.json')));
  await ensureLoudness16Enabled(faildir,read,enable);assert.equal(writes,2,'Retry completes restart even after registry write succeeded');
  await ensureLoudness16Enabled(path.join(directory,'already-enabled'),read,enable);assert.equal(writes,2,'Already enabled does not restart audio');
 }finally{await fs.rm(directory,{recursive:true,force:true})}
 console.log('PASS: registry variants 0/3/1599, master disable, defaults, one-time enable, release preservation, retry and later user choice. No live writes.');
})().catch(e=>{console.error(e);process.exitCode=1});
