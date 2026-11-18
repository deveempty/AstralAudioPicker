const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const {chromium}=require(path.join(require('node:os').homedir(),'.codex/skills/unslop/node_modules/playwright-core'));
(async()=>{
 const bundle=await esbuild.build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{ChakraProvider}from'@chakra-ui/react';import{system}from'./src/theme';import{I18nProvider}from'./src/i18n';import{Loudness16Provider,useLoudness16}from'./src/components/Loudness16Provider';import Control from'./src/components/Loudness16Control';import Quick from'./src/components/LoudnessQuickControl';function Probe(){const{state,commit}=useLoudness16();return <button onClick={()=>{void commit({enabled:state.enabled});void commit({releaseTime:state.releaseTime})}}>Same values</button>}createRoot(document.getElementById('root')).render(<ChakraProvider value={system}><I18nProvider><Loudness16Provider><Control/><Quick/><Probe/></Loudness16Provider></I18nProvider></ChakraProvider>)`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false,define:{'process.env.NODE_ENV':'"development"'}});
 const browser=await chromium.launch({headless:true});
 try{for(const lang of ['en','es']){
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://loudness.test/**',r=>r.fulfill({contentType:r.request().url().endsWith('.js')?'application/javascript':'text/html',body:r.request().url().endsWith('.js')?bundle.outputFiles[0].text:'<!doctype html><meta charset="utf-8"><div id="root"></div><script src="/bundle.js"></script>'}));
  await page.addInitScript(lang=>{
   localStorage.setItem('astral-audio.language.v1',lang);window.calls=[];window.testState={deviceId:'16',enabled:true,releaseTime:0};
   window.electronAPI={getLoudness16:async()=>({...window.testState}),setLoudness16:change=>new Promise(resolve=>{window.calls.push(change);window.finishWrite=()=>{Object.assign(window.testState,change);resolve({...window.testState})}})};
  },lang);
  await page.goto('http://loudness.test/');const checkbox=page.getByRole('checkbox',{name:'Loudness EQ',exact:true});await checkbox.waitFor();
  await page.evaluate(()=>{window.electronAPI.getLoudness16=()=>new Promise(resolve=>{window.finishRead=()=>resolve({...window.testState})});window.dispatchEvent(new Event('focus'))});
  await page.waitForFunction(()=>typeof window.finishRead==='function');
  const reading=lang==='en'?'Checking current setting…':'Consultando el estado actual…';
  await page.getByRole('status').filter({hasText:reading}).first().waitFor();
  assert.equal(await page.getByRole('status').filter({hasText:reading}).count(),2);
  assert.deepEqual(await page.evaluate(()=>window.calls),[],'Focus only reads; no write IPC');
  await page.evaluate(()=>window.finishRead());await page.waitForFunction(()=>!document.querySelector('input[type=checkbox]').disabled);
  await page.getByRole('button',{name:'Same values'}).click();
  await page.getByRole('slider').press('Home');await page.getByRole('slider').press('Tab');
  assert.deepEqual(await page.evaluate(()=>window.calls),[],'Identical values and slider blur do not write');
  await page.getByRole('slider').press('ArrowRight');await page.waitForFunction(()=>window.calls.length===1);
  assert.equal(await page.getByRole('status').count(),2);assert.equal(await page.getByRole('status').filter({hasText:reading}).count(),0);
  await page.evaluate(()=>window.finishWrite());await page.waitForFunction(()=>!document.querySelector('input[type=checkbox]').disabled);
  await page.getByRole('button',{name:'Same values'}).click();assert.deepEqual(await page.evaluate(()=>window.calls),[{releaseTime:20}]);
  await checkbox.click();await page.waitForFunction(()=>window.calls.length===2);await page.evaluate(()=>window.finishWrite());await page.waitForFunction(()=>!document.querySelector('input[type=checkbox]').checked);
  assert.deepEqual(await page.evaluate(()=>window.calls),[{releaseTime:20},{enabled:false}]);assert.deepEqual(errors,[]);await page.close();
 }console.log('PASS: EN/ES focus reads never show Applying, unchanged values/blur never write, real slider/toggle edits write once and share applying state in card/footer. Mock IPC; no audio restart.');}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
