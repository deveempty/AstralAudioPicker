import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
import ts from 'typescript';
import {minimumForRelease} from '../scripts/update-policy.mjs';
const require=createRequire(import.meta.url);
function load(file,mocks={}){
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:n=>mocks[n]??require(n),Error,setTimeout:()=>0,setImmediate:fn=>fn()});return module.exports;
}
const roots=[['Picker',path.resolve('electron/required-update.ts')],['Core','D:/AstralCore/optimization-hub/astral-core-v2-lite/electron/capabilities/updates/required-update.ts'],['Clipper','D:/AstralCore/AstralClipper/src/desktop/required-update.ts']];
for(const [name,file] of roots)test(name+' minimum is numeric, persistent, monotonic and optional by default',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'astral-policy-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const {RequiredUpdatePolicy,belowVersion}=load(file),cache=path.join(dir,'policy.json');
 const policy=new RequiredUpdatePolicy(cache,'1.9.0');assert.equal(policy.required,false);
 policy.accept('1.10.0',undefined);assert.equal(policy.required,false);
 assert.equal(belowVersion('1.9.0','1.10.0'),true);
 policy.accept('1.10.0','1.10.0');assert.equal(policy.required,true);
 policy.accept('1.11.0',undefined);policy.accept('1.11.0','1.0.0');assert.equal(policy.minimumVersion,'1.10.0');
 assert.equal(new RequiredUpdatePolicy(cache,'1.9.0').required,true);
 assert.equal(new RequiredUpdatePolicy(cache,'1.10.0').required,false);
 for(const minimum of ['2.0.0','broken',true])assert.throws(()=>policy.accept('1.11.0',minimum));
});
test('Publishing marks required only explicitly and retains that floor on later optional releases',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'astral-release-policy-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 assert.equal(minimumForRelease(dir,'1.0.0',false),undefined);
 assert.equal(minimumForRelease(dir,'1.1.0',true,false),'1.1.0');
 assert.equal(fs.existsSync(path.join(dir,'release-policy.json')),false);
 assert.equal(minimumForRelease(dir,'1.1.0',true),'1.1.0');
 assert.equal(minimumForRelease(dir,'1.2.0',false),'1.1.0');
 assert.throws(()=>minimumForRelease(dir,'1.0.0',false));
});
test('Picker retains required status on download failure and never unlocks its backend',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'picker-required-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const auto=new EventEmitter(),handlers=new Map();
 auto.checkForUpdates=async()=>{auto.emit('update-available',{version:'3.2.0',minimumVersion:'3.2.0'});return {}};
 const policy=load('electron/required-update.ts');
 const api=load('electron/updater.ts',{'electron':{app:{isPackaged:true,getVersion:()=> '3.1.5',getPath:()=>dir},ipcMain:{handle:(k,v)=>handlers.set(k,v)}},'electron-updater':{autoUpdater:auto},'./required-update':policy});
 api.initializeAutoUpdater({isDestroyed:()=>false,webContents:{send:()=>{}}});
 assert.equal(api.pickerUpdateBlocked(),true);
 await api.checkForPickerUpdates();assert.equal(handlers.get('get-picker-update-status')().required,true);
 auto.emit('download-progress',{percent:35});assert.equal(handlers.get('get-picker-update-status')().version,'3.2.0');
 auto.emit('error',Error('offline'));assert.equal(api.pickerUpdateBlocked(),true);assert.equal(handlers.get('get-picker-update-status')().required,true);
});
test('Core preserves required state after a failed check',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'core-required-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const root='D:/AstralCore/optimization-hub/astral-core-v2-lite/electron/capabilities/updates/';
 const auto=new EventEmitter();auto.setFeedURL=()=>{};auto.checkForUpdates=async()=>auto.emit('update-available',{version:'5.2.0',minimumVersion:'5.2.0'});
 const {createAutoUpdateCapability}=load(root+'autoUpdateCapability.ts',{'electron':{app:{isPackaged:true,getVersion:()=> '5.1.4',getPath:()=>dir}},'electron-log':{error:()=>{}},'electron-updater':{autoUpdater:auto},'./required-update':load(root+'required-update.ts')});
 const api=createAutoUpdateCapability(async()=> 'test');api.init({isDestroyed:()=>false,webContents:{send:()=>{}}});
 assert.equal((await api.check()).required,true);auto.checkForUpdates=async()=>{throw Error('offline')};
 assert.equal((await api.check()).required,true);assert.equal(api.blocked(),true);
});
