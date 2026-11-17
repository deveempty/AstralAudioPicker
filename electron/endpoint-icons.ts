import {app} from 'electron'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import path from 'node:path'
import fs from 'node:fs/promises'

const migrationId='endpoint-icons-v2-normal-audio'
// One-time migration shipped by Picker for existing installations. The marker
// is machine-wide and independent of app version; failures may retry next launch.
// Cosmetic failures must never block access to the app.
export async function updateEndpointIcons():Promise<void>{
 if(!app.isPackaged||process.platform!=='win32')return
 if(!process.env.ProgramData)throw Error('PROGRAMDATA_UNAVAILABLE')
 const root=path.join(process.env.ProgramData,'AstralAudio','migrations')
 const marker=path.join(root,`${migrationId}.json`)
 try{
  const saved=JSON.parse(await fs.readFile(marker,'utf8'))
  if(saved.id===migrationId&&saved.completed===true)return
 }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT'&&!(error instanceof SyntaxError))throw error}
 await promisify(execFile)('powershell.exe',[
  '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
  '-File',path.join(process.resourcesPath,'scripts','UpdateEndpointIcons.ps1'),
  '-SourceDirectory',path.join(process.resourcesPath,'branding','endpoint-icons'),'-Apply',
 ],{windowsHide:true,timeout:30000})
 await promisify(execFile)('powershell.exe',[
  '-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
  '-File',path.join(process.resourcesPath,'scripts','RenameNormalAudio.ps1'),'-Apply',
 ],{windowsHide:true,timeout:30000})
 await fs.mkdir(root,{recursive:true})
 const temporary=`${marker}.tmp`
 await fs.writeFile(temporary,JSON.stringify({id:migrationId,completed:true,appVersion:app.getVersion(),completedAt:new Date().toISOString()}),'utf8')
 await fs.rename(temporary,marker)
}
