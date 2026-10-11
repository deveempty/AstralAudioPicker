import {dialog,type BrowserWindow} from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {PluginPresetLibrary,PresetError} from './plugin-presets'
import type {PluginTransferResult} from '../shared/plugin-control'
export function createPluginTransfer(library:PluginPresetLibrary,window:()=>BrowserWindow|null){
 let busy=false
 const run=async(work:()=>Promise<PluginTransferResult>):Promise<PluginTransferResult>=>{if(busy)return {success:false,code:'busy'};busy=true;try{return await work()}catch(e){return {success:false,code:e instanceof PresetError?e.code:'storage'}}finally{busy=false}}
 return {
  import:()=>run(async()=>{const owner=window();if(!owner)throw Error('window');const choice=await dialog.showOpenDialog(owner,{properties:['openFile'],filters:[{name:'Cosmic JSON',extensions:['json']}]});if(choice.canceled||!choice.filePaths[0])return {success:true,canceled:true};const file=choice.filePaths[0];if((await fs.stat(file)).size>16384)throw new PresetError('invalidPreset');const saved=library.importFile(await fs.readFile(file,'utf8'));return {success:true,canceled:false,library:{success:true,profiles:library.list(),directory:library.directory,savedId:saved.id}}}),
  export:(id:unknown)=>run(async()=>{const preset=library.read(id),owner=window();if(!owner)throw Error('window');const name=preset.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'')||'Cosmic';const choice=await dialog.showSaveDialog(owner,{defaultPath:name+'.cosmic.json',filters:[{name:'Cosmic JSON',extensions:['json']}]});if(choice.canceled||!choice.filePath)return {success:true,canceled:true};const temporary=path.join(path.dirname(choice.filePath),randomUUID()+'.tmp');try{await fs.writeFile(temporary,JSON.stringify({schema:'astral-v3-named-preset',version:1,stateVersion:3,name:preset.name,values:preset.values},null,2)+'\n',{flag:'wx'});await fs.rename(temporary,choice.filePath)}finally{await fs.rm(temporary,{force:true})};return {success:true,canceled:false}})
 }
}
