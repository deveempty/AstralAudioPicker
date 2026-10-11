import fs from 'node:fs/promises'
import path from 'node:path'
import {execFile} from 'node:child_process'
import {MAIN_CONFIG_FILE} from './astral-paths'
import {CUSTOM_OUTPUT_DLL,customOutputActive} from './custom-output'
import {pluginControlDirectory} from './plugin-control'
import {isPluginState,isPluginEvidence,pluginFingerprint} from '../shared/plugin-control'
import type {DiagnosticCheck,DiagnosticReport} from '../shared/diagnostics'
async function readable(file:string){try{const s=await fs.stat(file);if(!s.isFile()||s.size===0)return false;await fs.access(file);return true}catch{return false}}
export async function inspectConfigTree(file:string){
 const visited=new Set<string>(),missing:string[]=[],invalid:string[]=[]
 async function visit(current:string,stack:string[]){const key=path.resolve(current).toLowerCase();if(stack.includes(key)){invalid.push(current);return}if(visited.has(key))return;if(visited.size>=128||stack.length>=16){invalid.push(current);return}visited.add(key)
  try{const stat=await fs.stat(current);if(stat.size>2*1024*1024)throw Error('size');const text=await fs.readFile(current,'utf8');for(const raw of text.split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith('#'))continue;const include=/^Include:\s*(.+)$/i.exec(line),dll=/^VSTPlugin:\s*Library\s+(?:"([^"]+)"|(.+?\.dll))(?:\s|$)/i.exec(line);const target=include?.[1]?.replace(/^"|"$/g,'')??dll?.[1]??dll?.[2];if(!target)continue;const resolved=path.resolve(path.dirname(current),target);if(!await readable(resolved)){missing.push(resolved);continue}if(include)await visit(resolved,[...stack,key])}}
  catch{invalid.push(current)}
 }
 await visit(file,[]);return {missing:[...new Set(missing)],invalid:[...new Set(invalid)],count:visited.size}
}
function windowsAudio():Promise<{services:boolean;endpoints:string[]|null}>{return new Promise((resolve,reject)=>{const script=`$ErrorActionPreference='Stop'; $s=@(Get-Service audiosrv,AudioEndpointBuilder); $d=$null; try { $d=@(Get-PnpDevice -Class AudioEndpoint -Status OK | Where-Object { $_.InstanceId -like '*{0.0.0*' } | ForEach-Object { $_.FriendlyName }) } catch {}; @{ services=(@($s | Where-Object Status -ne 'Running').Count -eq 0); endpoints=$d } | ConvertTo-Json -Compress`;execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:15000,maxBuffer:1024*1024},(error,out)=>{if(error){reject(error);return}try{resolve(JSON.parse(out))}catch(e){reject(e)}})})}
export async function runDiagnostics():Promise<DiagnosticReport>{
 const checks:DiagnosticCheck[]=[];const add=(id:string,status:DiagnosticCheck['status'],detail:string,paths?:string[])=>checks.push({id,status,detail,paths})
 const configOk=await readable(MAIN_CONFIG_FILE);let cosmic=false
 add('config',configOk?'ok':'error',configOk?'readable':'missing',[MAIN_CONFIG_FILE])
 const selectors=['DeviceSelector.exe','Configurator.exe'].map(n=>path.resolve(path.dirname(MAIN_CONFIG_FILE),'..',n));const installed=[];for(const file of selectors)if(await readable(file))installed.push(file);add('apo',installed.length?'ok':'warning','apoInstall',installed.length?installed:selectors)
 if(configOk){try{const text=await fs.readFile(MAIN_CONFIG_FILE,'utf8');cosmic=customOutputActive(text);const tree=await inspectConfigTree(MAIN_CONFIG_FILE);add('chain',tree.missing.length||tree.invalid.length?'error':'ok',tree.missing.length||tree.invalid.length?'brokenChain':'chainOk',[...tree.missing,...tree.invalid]);add('route',cosmic?'ok':'info',cosmic?'cosmicActive':'cosmicInactive')}catch{add('chain','unknown','unreadable')}}
 try{const dll=await fs.open(CUSTOM_OUTPUT_DLL,'r');try{const header=Buffer.alloc(64);await dll.read(header,0,64,0);const offset=header.readUInt32LE(60),stat=await dll.stat();if(header.toString('ascii',0,2)!=='MZ'||offset>stat.size-6)throw Error('invalid');const pe=Buffer.alloc(6);await dll.read(pe,0,6,offset);if(pe.readUInt32LE(0)!==0x4550||pe.readUInt16LE(4)!==0x8664)throw Error('invalid');add('dll','ok','dllValid',[CUSTOM_OUTPUT_DLL])}finally{await dll.close()}}catch{add('dll',cosmic?'error':'warning','dllMissing',[CUSTOM_OUTPUT_DLL])}
 const control=pluginControlDirectory(),stateFile=path.join(control,'profile.json');try{const state=JSON.parse(await fs.readFile(stateFile,'utf8'));if(!isPluginState(state))throw Error('invalid');add('settings','ok','settingsValid',[stateFile]);if(cosmic){let confirmed=false,bypass=false;const names=await fs.readdir(path.join(control,'instances')).catch(()=>[]);for(const name of names.filter(n=>n.endsWith('.json')).slice(0,128)){try{const file=path.join(control,'instances',name);if((await fs.stat(file)).size>8192)continue;const i=JSON.parse(await fs.readFile(file,'utf8'));if(i.schema!=='astral-plugin-instance-v1'||i.audioService!==true||!Number.isFinite(i.updatedAt)||Date.now()-i.updatedAt<0||Date.now()-i.updatedAt>1500||!isPluginEvidence(i.evidence))continue;bypass ||= i.evidence.state===2;confirmed ||= i.evidence.state===1&&i.evidence.hash===pluginFingerprint(state.values)&&i.audioRevision>=state.revision}catch{}}add('engine',confirmed?'ok':'warning',confirmed?'engineConfirmed':bypass?'bypass':'engineUnconfirmed')}else add('engine','info','cosmicInactive')}
 catch{add('settings',cosmic?'warning':'info','settingsMissing',[stateFile]);add('engine','unknown','engineUnconfirmed')}
 try{const system=await windowsAudio();add('services',system.services?'ok':'error',system.services?'servicesRunning':'servicesStopped');const cables=(system.endpoints??[]).filter(n=>/cable/i.test(n));add('cable',system.endpoints===null?'unknown':cables.length?'ok':'warning',system.endpoints===null?'systemUnavailable':cables.length?'cableFound':'cableMissing',cables);if(cosmic)add('device',system.endpoints===null?'unknown':cables.some(n=>/CABLE In 16ch/i.test(n))?'ok':'warning','deviceExpected',cables)}catch{add('services','unknown','systemUnavailable');add('cable','unknown','systemUnavailable')}
 add('format','unknown','manualFormat');add('effects','unknown','manualEffects')
 return {checkedAt:Date.now(),checks}
}
