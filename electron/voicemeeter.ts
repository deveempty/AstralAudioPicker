import koffi from 'koffi'
import fs from 'node:fs'
import path from 'node:path'
import {execFile,spawn} from 'node:child_process'
import {promisify} from 'node:util'
import type {VmCommand,VmDevice,VmState} from '../shared/voicemeeter'
import {vmDrivers,vmSettingValues,type VmSetting,type VmSettings} from '../shared/voicemeeter'

const run=promisify(execFile),delay=(ms:number)=>new Promise(r=>setTimeout(r,ms))
export function relayRestartSettled(before:VmState,after:VmState){
 const gain=(a:number,b:number)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<0.01
 return after.connected&&after.edition===before.edition&&after.bus.name===before.bus.name&&gain(after.bus.gain,before.bus.gain)&&after.bus.mute===before.bus.mute&&after.strips.length===before.strips.length&&after.strips.every((s,i)=>s.name===before.strips[i].name&&gain(s.gain,before.strips[i].gain)&&s.mute===before.strips[i].mute)&&Object.entries(before.settings??{}).every(([key,value])=>after.settings?.[key as VmSetting]===value)
}
const blank=():VmState=>({installed:false,connected:false,edition:0,inputs:[],outputs:[],strips:[],bus:{name:'',gain:0,mute:false,peakDb:-120}})
export function createVoicemeeter(preferredEdition:()=>number=()=>1){
 let folder='',api:ReturnType<typeof bind>|undefined,logged=false,initializing:Promise<void>|undefined,busy=false
 function bind(file:string){
  const dll=koffi.load(file),f=(signature:string)=>dll.func(signature)
  return {login:f('int __stdcall VBVMR_Login()'),logout:f('int __stdcall VBVMR_Logout()'),dirty:f('int __stdcall VBVMR_IsParametersDirty()'),type:f('int __stdcall VBVMR_GetVoicemeeterType(_Out_ int *value)'),
   get:f('int __stdcall VBVMR_GetParameterFloat(const char *name, _Out_ float *value)'),set:f('int __stdcall VBVMR_SetParameterFloat(const char *name, float value)'),
   getText:f('int __stdcall VBVMR_GetParameterStringW(const char *name, void *value)'),setText:f('int __stdcall VBVMR_SetParameterStringW(const char *name, const char16_t *value)'),
   inputCount:f('int __stdcall VBVMR_Input_GetDeviceNumber()'),outputCount:f('int __stdcall VBVMR_Output_GetDeviceNumber()'),
   inputDesc:f('int __stdcall VBVMR_Input_GetDeviceDescW(int index, _Out_ int *type, void *name, void *id)'),outputDesc:f('int __stdcall VBVMR_Output_GetDeviceDescW(int index, _Out_ int *type, void *name, void *id)'),
   level:f('int __stdcall VBVMR_GetLevel(int type, int channel, _Out_ float *level)')}
 }
 async function init(){
  if(api)return
  if(initializing)return initializing
  initializing=(async()=>{
   if(process.platform!=='win32'||process.arch!=='x64')throw Error('VM_PLATFORM')
   const candidates:string[]=[]
   for(const view of ['32','64'])try{
    const {stdout}=await run('reg.exe',['query','HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VB:Voicemeeter {17359A74-1236-5467}','/v','UninstallString',`/reg:${view}`],{windowsHide:true,timeout:5000})
    const value=stdout.match(/REG_SZ\s+(.+)/)?.[1]?.trim(),exe=value?.match(/^"([^"]+)"/)?.[1]??value?.match(/^(.+?\.exe)/i)?.[1]
    if(exe)candidates.push(path.dirname(exe))
   }catch{}
   candidates.push(path.join(process.env['ProgramFiles(x86)']||'C:\\Program Files (x86)','VB','Voicemeeter'))
   folder=candidates.find(p=>fs.existsSync(path.join(p,'VoicemeeterRemote64.dll')))??''
   if(!folder)throw Error('VM_NOT_INSTALLED')
   api=bind(path.join(folder,'VoicemeeterRemote64.dll'));const code=api.login();if(code<0){api=undefined;throw Error('VM_LOGIN')};logged=true
  })().finally(()=>{initializing=undefined})
  return initializing
 }
 const check=(code:number)=>{if(code<0)throw Error('VM_COMMAND_FAILED')}
 function number(name:string){const value=[0];check(api!.get(name,value));return value[0]}
 function text(name:string){const buffer=Buffer.alloc(4096);check(api!.getText(name,buffer));return buffer.toString('utf16le').split('\0')[0]}
 const settingParameter=(key:VmSetting)=>key==='sr'?'Option.sr':`Option.buffer.${key}`
 function settings():VmSettings{const result:VmSettings={};for(const key of Object.keys(vmSettingValues) as VmSetting[])try{result[key]=number(settingParameter(key))}catch{}return result}
 function devices(input:boolean):VmDevice[]{
  const count=(input?api!.inputCount:api!.outputCount)(),result:VmDevice[]=[];check(count)
  for(let i=0;i<Math.min(count,256);i++){const type=[0],name=Buffer.alloc(4096),id=Buffer.alloc(4096);if((input?api!.inputDesc:api!.outputDesc)(i,type,name,id)!==0)continue
   if(!vmDrivers[type[0]]||(input&&type[0]===5))continue
   const deviceName=name.toString('utf16le').split('\0')[0],hardwareId=id.toString('utf16le').split('\0')[0]
   result.push({key:JSON.stringify([type[0],hardwareId,deviceName]),name:deviceName,type:type[0],hardwareId})
  }return result
 }
 function peak(type:number,offset:number){let max=0;for(let i=0;i<2;i++){const value=[0];if(api!.level(type,offset+i,value)===0)max=Math.max(max,value[0])}return max>0?Math.round(20*Math.log10(max)):-120}
 async function status():Promise<VmState>{
  try{await init();const state=blank();state.installed=true;if(api!.dirty()<0)return state
   const type=[0];if(api!.type(type)<0)return state;state.connected=true;state.edition=type[0]
   state.inputs=devices(true);state.outputs=devices(false);state.settings=settings()
   state.strips=[0,1].map(i=>({name:text(`Strip[${i}].device.name`),gain:number(`Strip[${i}].Gain`),mute:number(`Strip[${i}].Mute`)!==0,peakDb:peak(1,i*2)}))
   state.bus={name:text('Bus[0].device.name'),gain:number('Bus[0].Gain'),mute:number('Bus[0].Mute')!==0,peakDb:peak(3,0)};return state
  }catch(error){return {...blank(),installed:!!folder,error:error instanceof Error?error.message:'VM_ERROR'}}
 }
 // Hide only top-level windows belonging to the installed Voicemeeter executables.
 function hide(){
  const user=koffi.load('user32.dll'),kernel=koffi.load('kernel32.dll')
  const next=user.func('void * __stdcall FindWindowExW(void *parent,void *after,const char16_t *cls,const char16_t *title)')
  const pidOf=user.func('uint32_t __stdcall GetWindowThreadProcessId(void *window,_Out_ uint32_t *pid)'),show=user.func('int __stdcall ShowWindow(void *window,int mode)')
  const open=kernel.func('void * __stdcall OpenProcess(uint32_t access,int inherit,uint32_t pid)'),query=kernel.func('int __stdcall QueryFullProcessImageNameW(void *process,uint32_t flags,void *name,_Inout_ uint32_t *size)'),close=kernel.func('int __stdcall CloseHandle(void *handle)')
  let window:unknown=null
  while((window=next(null,window,null,null))){const pid=[0];pidOf(window,pid);const processHandle=open(0x1000,0,pid[0]);if(!processHandle)continue
   try{const buffer=Buffer.alloc(8192),size=[4096];if(query(processHandle,0,buffer,size)){const exe=buffer.toString('utf16le',0,size[0]*2);if(path.dirname(exe).toLowerCase()===folder.toLowerCase()&&/^voicemeeter(?:pro|8)?(?:_x64)?\.exe$/i.test(path.basename(exe)))show(window,0)}}finally{close(processHandle)}
  }
 }
 async function command(request:VmCommand):Promise<VmState>{
  if(busy)throw Error('VM_BUSY');busy=true
  try{
   await init();let current=await status()
   if(request.action==='connect'){
    if(!current.connected){const exe=path.join(folder,preferredEdition()===3?'voicemeeter8.exe':preferredEdition()===2?'voicemeeterpro.exe':'voicemeeter.exe');if(!fs.existsSync(exe))throw Error('VM_NOT_INSTALLED');const child=spawn(exe,[],{windowsHide:true,detached:true,stdio:'ignore'});child.on('error',()=>{});child.unref()
     for(let i=0;i<40&&!current.connected;i++){await delay(100);hide();current=await status()}
    }
    if(!current.connected)throw Error('VM_NOT_RUNNING');hide();return current
   }
   if(!current.connected)throw Error('VM_NOT_RUNNING')
   if(request.action==='hide')hide()
   else if(request.action==='show')check(api!.set('Command.Show',1))
   else if(request.action==='restart')check(api!.set('Command.Restart',1))
   else if(request.action==='device'){
    if(request.target!=='input'&&request.target!=='output')throw Error('VM_INVALID_CONTROL')
    const input=request.target==='input',list=input?current.inputs:current.outputs,device=list.find(d=>d.key===request.key)
    if(!device||(!input&&/VB-Audio|Voicemeeter|CABLE/i.test(device.name))||(input&&device.name===current.strips[1]?.name))throw Error('VM_INVALID_ROUTE')
    if(list.filter(d=>d.name===device.name&&d.type===device.type).length!==1)throw Error('VM_AMBIGUOUS_DEVICE')
    const wasMuted=current.bus.mute;check(api!.set('Bus[0].Mute',1))
    check(api!.setText(`${input?'Strip[0]':'Bus[0]'}.device.${vmDrivers[device.type]}`,device.name))
    let confirmed=false
    for(let i=0;i<30;i++){await delay(100);current=await status();if(current.connected&&(input?current.strips[0]?.name:current.bus.name)===device.name){confirmed=true;break}}
    if(!confirmed)throw Error('VM_ROUTE_UNCONFIRMED')
    check(api!.set('Bus[0].Mute',wasMuted?1:0))
   }
   else if(request.action==='settings'){
    if(!request.values||typeof request.values!=='object')throw Error('VM_INVALID_SETTINGS')
    const entries=Object.entries(request.values) as [VmSetting,number][]
    if(!entries.length||entries.some(([key,value])=>!Object.prototype.hasOwnProperty.call(vmSettingValues,key)||!vmSettingValues[key].includes(value)||current.settings?.[key]===undefined))throw Error('VM_INVALID_SETTINGS')
    const wasMuted=current.bus.mute;check(api!.set('Bus[0].Mute',1))
    for(const [key,value] of entries)check(api!.set(settingParameter(key),value))
    check(api!.set('Command.Restart',1))
    let confirmed=false
    for(let i=0;i<40;i++){await delay(100);current=await status();if(current.connected&&entries.every(([key,value])=>current.settings?.[key]===value)){confirmed=true;break}}
    if(!confirmed)throw Error('VM_SETTINGS_UNCONFIRMED')
    check(api!.set('Bus[0].Mute',wasMuted?1:0))
   }
   else if(request.action==='route'){
    const a=current.inputs.find(d=>d.key===request.input1),b=request.input2?current.inputs.find(d=>d.key===request.input2):undefined,out=current.outputs.find(d=>d.key===request.output)
    if(!a||!out||(request.input2&&!b)||(b&&(a.name===b.name||!!a.hardwareId&&a.hardwareId===b.hardwareId))||/VB-Audio|Voicemeeter|CABLE/i.test(out.name))throw Error('VM_INVALID_ROUTE')
    if(current.inputs.filter(x=>x.name===a.name&&x.type===a.type).length!==1||current.outputs.filter(x=>x.name===out.name&&x.type===out.type).length!==1||(b&&current.inputs.filter(x=>x.name===b.name&&x.type===b.type).length!==1))throw Error('VM_AMBIGUOUS_DEVICE')
    // Device assignment is asynchronous. Hold the existing master mute until readback confirms it.
    const wasMuted=current.bus.mute;check(api!.set('Bus[0].Mute',1))
    try{
     check(api!.setText(`Bus[0].device.${vmDrivers[out.type]}`,out.name));check(api!.setText(`Strip[0].device.${vmDrivers[a.type]}`,a.name));check(api!.setText(`Strip[1].device.${b?vmDrivers[b.type]:'mme'}`,b?.name??''))
     check(api!.set('Strip[0].A1',1));check(api!.set('Strip[1].A1',b?1:0))
     let matched=false
     for(let i=0;i<30;i++){await delay(100);current=await status();if(current.bus.name===out.name&&current.strips[0]?.name===a.name&&current.strips[1]?.name===(b?.name??'')){matched=true;break}}
     if(!matched)throw Error('VM_ROUTE_UNCONFIRMED')
     check(api!.set('Bus[0].Mute',wasMuted?1:0))
    }catch(error){throw error} // Keep A1 muted on partial/failed assignment.
   }else if(request.action==='gain'||request.action==='mute'){
    if(!['input','output'].includes(request.target)||!Number.isInteger(request.index)||request.index<0||request.index>(request.target==='input'?1:0)||!Number.isFinite(request.value))throw Error('VM_INVALID_CONTROL')
    if(request.action==='gain'&&(request.value< -60||request.value>12)||request.action==='mute'&&![0,1].includes(request.value))throw Error('VM_INVALID_CONTROL')
    check(api!.set(`${request.target==='input'?'Strip':'Bus'}[${request.index}].${request.action==='gain'?'Gain':'Mute'}`,request.value))
   }else throw Error('VM_INVALID_CONTROL')
   await delay(100);return status()
  }finally{busy=false}
 }
 // Keep route/settings commands out of an endpoint restart. Reopen the existing
 // engine afterwards, including when the endpoint operation reports an error.
 async function withEndpointRestart<T>(operation:()=>Promise<T>):Promise<T>{
  if(busy)throw Error('VM_BUSY')
  busy=true
  try{
   const before=await status()
   try{return await operation()}
   finally{
    if(before.connected){
     try{
      check(api!.set('Command.Restart',1))
      let confirmed=false,stable=0
      for(let i=0;i<30;i++){
       await delay(200)
       const after=await status()
       stable=relayRestartSettled(before,after)?stable+1:0
       if(stable>=2){confirmed=true;break}
      }
      if(!confirmed)throw Error('VM_ROUTE_UNCONFIRMED')
     }catch(error){console.error('Relay reconnect after endpoint restart:',error);throw Error('LOUDNESS_RELAY_RESTART_FAILED')}
    }
   }
  }finally{busy=false}
 }
 async function backupSettings(file:string){
  if(busy)throw Error('VM_BUSY');busy=true
  try{
   await init();if(!(await status()).connected)throw Error('VM_NOT_RUNNING')
   if(!path.isAbsolute(file)||path.extname(file)!=='.xml'||fs.existsSync(file))throw Error('VM_BACKUP_PATH')
   fs.mkdirSync(path.dirname(file),{recursive:true})
   check(api!.setText('Command.Save',file))
   for(let i=0;i<30;i++){await delay(100);if(fs.existsSync(file)&&fs.statSync(file).size>0){const xml=fs.readFileSync(file);if(xml.includes(Buffer.from('<'))||xml.includes(Buffer.from('<','utf16le')))return}}
   throw Error('VM_BACKUP_UNCONFIRMED')
  }finally{busy=false}
 }
 return {status,command,withEndpointRestart,backupSettings,async executables(){await init();return [1,2,3].map(edition=>({edition,path:path.join(folder,edition===3?'voicemeeter8.exe':edition===2?'voicemeeterpro.exe':'voicemeeter.exe')})).filter(e=>fs.existsSync(e.path))},dispose(){if(logged){api?.logout();logged=false}/* Engine intentionally remains running. */}}
}
