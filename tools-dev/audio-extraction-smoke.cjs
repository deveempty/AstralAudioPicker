const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),esbuild=require('esbuild');
esbuild.buildSync({entryPoints:['electron/audio-content.ts'],bundle:true,platform:'node',format:'cjs',outfile:'output/audio-extraction-test.cjs'});
const {extractAudioContent}=require('../output/audio-extraction-test.cjs');
const ps=script=>cp.execFileSync(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from("$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem; "+script,'utf16le').toString('base64')],{windowsHide:true});
const q=value=>"'"+value.replaceAll("'","''")+"'";
(async()=>{
 const base=await fs.mkdtemp(path.resolve('output/extraction-'));
 const root=path.join(base,"Miguel's audífonos 日本"),source=path.join(root,'source'),zip=path.join(root,'content.zip'),stage=path.join(root,'stage');
 const names=['RØDE/NTH-100.txt','AüR/Leá PHöNIX.txt','測定/耳機.txt'];
 for(const name of names){const file=path.join(source,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,'verified unicode payload');}
 ps(`[IO.Compression.ZipFile]::CreateFromDirectory(${q(source)},${q(zip)})`);
 await fs.mkdir(stage);await extractAudioContent(zip,stage);
 for(const name of names)assert.equal(await fs.readFile(path.join(stage,name),'utf8'),'verified unicode payload');
 const corrupt=path.join(root,'broken.zip');await fs.writeFile(corrupt,'not a zip');
 await assert.rejects(extractAudioContent(corrupt,path.join(root,'broken-stage')),e=>e.message==='CONTENT_EXTRACTION_FAILED'&&!!e.cause.stderr);
 // A failed extraction must not overwrite an existing file.
 await fs.writeFile(path.join(stage,names[0]),'keep existing');
 await assert.rejects(extractAudioContent(zip,stage),/CONTENT_EXTRACTION_FAILED/);
 assert.equal(await fs.readFile(path.join(stage,names[0]),'utf8'),'keep existing');
 const unsafe=path.join(root,'unsafe.zip');
 ps(`$z=[IO.Compression.ZipFile]::Open(${q(unsafe)},[IO.Compression.ZipArchiveMode]::Create); try { $e=$z.CreateEntry('../escaped.txt'); $w=New-Object IO.StreamWriter($e.Open()); try {$w.Write('escape')} finally {$w.Dispose()} } finally {$z.Dispose()}`);
 await assert.rejects(extractAudioContent(unsafe,path.join(root,'safe-stage')),/CONTENT_EXTRACTION_FAILED/);
 await assert.rejects(fs.access(path.join(root,'escaped.txt')));
 console.log('PASS: Unicode entries and staging paths, apostrophes, corrupt ZIP classification, collision preservation and traversal rejection. All writes isolated in output/.');
})().catch(e=>{console.error(e);process.exitCode=1});
