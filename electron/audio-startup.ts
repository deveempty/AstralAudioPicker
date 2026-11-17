import {app} from 'electron'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import fs from 'node:fs/promises'
import path from 'node:path'
const run=promisify(execFile)
const options={windowsHide:true,timeout:15000}
const escapeXml=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;')
async function identity(){const {stdout}=await run('whoami.exe',['/user','/fo','csv','/nh'],options);const sid=stdout.match(/S-1-\d+(?:-\d+)+/)?.[0];if(!sid)throw Error('STARTUP_IDENTITY');return {sid,name:`AstralAudio-Startup-${sid}`}}
export function startupXml(sid:string,executable:string){return `<?xml version="1.0" encoding="UTF-16"?><Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"><Triggers><LogonTrigger><Enabled>true</Enabled><UserId>${escapeXml(sid)}</UserId></LogonTrigger></Triggers><Principals><Principal id="User"><UserId>${escapeXml(sid)}</UserId><LogonType>InteractiveToken</LogonType><RunLevel>HighestAvailable</RunLevel></Principal></Principals><Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries><StopIfGoingOnBatteries>false</StopIfGoingOnBatteries><ExecutionTimeLimit>PT0S</ExecutionTimeLimit><Enabled>true</Enabled></Settings><Actions Context="User"><Exec><Command>${escapeXml(executable)}</Command><Arguments>--audio-background</Arguments><WorkingDirectory>${escapeXml(path.dirname(executable))}</WorkingDirectory></Exec></Actions></Task>`}
export async function audioStartupStatus(){
 const supported=app.isPackaged&&process.platform==='win32'
 if(!supported)return {supported,enabled:false}
 const {name,sid}=await identity()
 let stdout:string
 try{stdout=(await run('schtasks.exe',['/Query','/TN',name,'/XML'],options)).stdout}catch{return {supported,enabled:false}}
 if(!stdout.includes(`<Command>${escapeXml(process.execPath)}</Command>`)||!stdout.includes('<Arguments>--audio-background</Arguments>')||!stdout.includes(`<UserId>${sid}</UserId>`))throw Error('STARTUP_TASK_CONFLICT')
 return {supported,enabled:!stdout.includes('<Enabled>false</Enabled>')}
}
let changing=false
export async function audioStartupSet(enabled:unknown){
 if(typeof enabled!=='boolean'||!app.isPackaged||process.platform!=='win32')throw Error('STARTUP_UNAVAILABLE')
 if(changing)throw Error('STARTUP_BUSY');changing=true
 try{
  const {sid,name}=await identity()
  if(enabled){const temp=await fs.mkdtemp(path.join(app.getPath('temp'),'astral-startup-'));const file=path.join(temp,'task.xml')
   try{await fs.writeFile(file,'\ufeff'+startupXml(sid,process.execPath),'utf16le');await run('schtasks.exe',['/Create','/TN',name,'/XML',file,'/F'],options)}finally{await fs.rm(file,{force:true});await fs.rmdir(temp)}
  }else if((await audioStartupStatus()).enabled)await run('schtasks.exe',['/Delete','/TN',name,'/F'],options)
  const state=await audioStartupStatus();if(state.enabled!==enabled)throw Error('STARTUP_UNCONFIRMED');return state
 }finally{changing=false}
}
