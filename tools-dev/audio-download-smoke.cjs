const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),{Readable}=require('node:stream'),{EventEmitter}=require('node:events'),esbuild=require('esbuild');
esbuild.buildSync({entryPoints:['electron/audio-download.ts'],bundle:true,platform:'node',format:'cjs',outfile:'output/audio-download-test.cjs'});
const {downloadVerified,withDownloadedAsset,downloadAssetPath}=require('../output/audio-download-test.cjs');
const payload=Buffer.from('test audio content'),spec={name:'mw4-content-v1.zip',bytes:payload.length,sha256:crypto.createHash('sha256').update(payload).digest('hex')};
const transport=({status=200,data=payload,length=data.length,broken=false}={})=>(_url,_opts,callback)=>{
 const request=new EventEmitter();request.setTimeout=()=>request;request.destroy=e=>{if(e)request.emit('error',e);request.emit('close')};
 process.nextTick(()=>{const response=Readable.from([data]);response.statusCode=status;response.headers={'content-length':String(length)};response.on('close',()=>request.emit('close'));callback(response);if(broken)response.destroy(Error('CONNECTION_RESET'))});return request;
};
const absent=async p=>{await assert.rejects(fs.stat(p),e=>e.code==='ENOENT')};
(async()=>{
 const root=await fs.mkdtemp(path.resolve('output/download-test-')),target=path.join(root,'download.zip');
 await downloadVerified(spec,target,transport());assert.deepEqual(await fs.readFile(target),payload);await fs.unlink(target);
 for(const input of [{status:404},{status:429},{status:302},{data:Buffer.alloc(payload.length)},{length:payload.length+1},{broken:true}]){await assert.rejects(downloadVerified(spec,target,transport(input)));await absent(target)}
 assert.throws(()=>downloadAssetPath({...spec,name:'../bad.exe'}));assert.throws(()=>downloadAssetPath({...spec,sha256:'invalid'}));
 let workspace;
 const fakeDownload=async(_spec,file)=>{await fs.writeFile(file,payload)};
 const result=await withDownloadedAsset(spec,async(file,dir)=>{workspace=dir;await fs.mkdir(path.join(dir,'extracted'));assert.deepEqual(await fs.readFile(file),payload);return 42},fakeDownload);
 assert.equal(result,42);await absent(workspace);
 await assert.rejects(withDownloadedAsset(spec,async(_file,dir)=>{workspace=dir;throw Error('INSTALL_FAILED')},fakeDownload),/INSTALL_FAILED/);await absent(workspace);
 await assert.rejects(withDownloadedAsset(spec,async()=>assert.fail('must not install'),async(_spec,file)=>{workspace=path.dirname(file);await fs.writeFile(file,'partial');throw Error('DOWNLOAD_FAILED')}),/DOWNLOAD_FAILED/);await absent(workspace);
 console.log('PASS: verified streamed download, HTTP rejection including redirects, size/hash rejection, interrupted transfer, temporary cleanup on success/install failure/download failure. No network requests.');
})().catch(e=>{console.error(e);process.exitCode=1});
