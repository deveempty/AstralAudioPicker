import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const valid=v=>typeof v==='string'&&/^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/.test(v);
const below=(a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]<y[i];return false;};
export function minimumForRelease(root,version,required=process.env.ASTRAL_REQUIRED_UPDATE==='1',persist=true) {
 if(!valid(version))throw Error('Invalid release version');
 const file=path.join(root,'release-policy.json');
 const policy=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};
 if(policy.minimumVersion!==undefined&&(!valid(policy.minimumVersion)||below(version,policy.minimumVersion)))throw Error('Invalid release minimum');
 const minimumVersion=required?version:policy.minimumVersion;
 if(required&&persist)fs.writeFileSync(file,JSON.stringify({minimumVersion},null,2)+'\n');
 return minimumVersion;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=process.cwd(),version=JSON.parse(fs.readFileSync('package.json','utf8')).version;
 const file=path.join(root,'release','latest.yml');
 if(!fs.existsSync(file))throw Error('Build the installer before preparing its update policy');
 let text=fs.readFileSync(file,'utf8');
 if(!text.split(/\r?\n/).includes('version: '+version))throw Error('Manifest version mismatch');
 const minimum=minimumForRelease(root,version,process.argv.includes('--required')||process.env.ASTRAL_REQUIRED_UPDATE==='1');
 text=text.replace(/^minimumVersion:.*\r?\n/gm,'');
 if(minimum)text+='\nminimumVersion: '+minimum+'\n';
 fs.writeFileSync(file,text);
 console.log(minimum?'Release minimum: '+minimum:'Optional release; no minimum version set');
}
