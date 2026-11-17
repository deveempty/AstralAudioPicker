const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
(async()=>{
 const version=JSON.parse(fs.readFileSync('package.json','utf8')).version;
 const cfg=JSON.parse(fs.readFileSync('electron-builder.json5','utf8'));
 const source=fs.readFileSync('electron/updater.ts','utf8');
 const key=source.match(/const UPDATE_API_KEY = '([^']+)'/)?.[1];if(!key)throw Error('Update authentication unavailable');
 const headers={'X-Audio-API-Key':key,'Cache-Control':'no-cache'};
 const base=cfg.publish.url+'/';
 const latest=await fetch(base+'latest.yml',{headers,signal:AbortSignal.timeout(30000)});
 assert.equal(latest.status,200,'Update manifest HTTP status');
 const text=await latest.text();assert.equal(text,fs.readFileSync('release/latest.yml','utf8'),'Published manifest differs');
 assert(text.split(/\r?\n/).includes('minimumVersion: '+version),'Required minimum missing');
 const results=[];
 for(const suffix of ['.exe','.exe.blockmap']){
  const name='Astral-Audio-Picker-Setup-'+version+suffix;
  const file=path.join('release',name);
  const expected=crypto.createHash('sha512').update(fs.readFileSync(file)).digest('base64');
  const response=await fetch(base+name,{headers,signal:AbortSignal.timeout(300000)});
  assert.equal(response.status,200,name+' HTTP status');let size=0;const hash=crypto.createHash('sha512');
  for await(const chunk of response.body){size+=chunk.length;hash.update(chunk)}
  assert.equal(size,fs.statSync(file).size);assert.equal(hash.digest('base64'),expected,name+' hash');
  results.push({name,bytes:size,sha512Verified:true});
 }
 const report={version,minimumVersion:version,verifiedAt:new Date().toISOString(),artifacts:results};
 fs.writeFileSync('output/published-picker-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1});
