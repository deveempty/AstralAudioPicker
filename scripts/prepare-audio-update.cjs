// Release preparation only. Runtime never reads the developer payload path.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const source=path.resolve(process.argv[2]||'../../ARCHIVOS/AT/AT');
const out=path.resolve('resources/audio-update'),stage=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'astral-content-'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const maps=[['9 - Presets_V5/MW4','presets'],['8 - Plugins/ArtTune_V5/atk_spatial_engine_charlie_v1_1_0.dll','charlie/atk_spatial_engine_charlie_v1_1_0.dll'],['11 - Measurements/measurements','measurements'],['4 - Targets','targets'],['12 - Equalizer Reference','reference-eq']];
const files=[];
function copy(from,to){if(fs.statSync(from).isDirectory()){for(const e of fs.readdirSync(from))copy(path.join(from,e),`${to}/${e}`);return}const dest=path.join(stage,to);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(from,dest);files.push({path:to,sha256:hash(dest),bytes:fs.statSync(dest).size})}
try{
 for(const [from,to] of maps)copy(path.join(source,from),to);
 fs.mkdirSync(out,{recursive:true});const zip=path.join(out,'mw4-content-v1.zip');
 const ps=`Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory('${stage.replaceAll("'","''")}','${(zip+'.tmp').replaceAll("'","''")}')`;
 if(fs.existsSync(zip+'.tmp'))throw Error('Previous staging zip exists');
 cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{windowsHide:true});fs.renameSync(zip+'.tmp',zip);
 const installer=path.join(out,'voicemeetersetup.exe');fs.copyFileSync(path.join(source,'2 - Voicemeeter/voicemeetersetup.exe'),installer);
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({id:'mw4-content-v1',archiveSha256:hash(zip),archiveBytes:fs.statSync(zip).size,files,installerSha256:hash(installer),installerBytes:fs.statSync(installer).size},null,2));
 console.log(JSON.stringify({files:files.length,archiveBytes:fs.statSync(zip).size,installerBytes:fs.statSync(installer).size}));
}finally{fs.rmSync(stage,{recursive:true,force:true})}
