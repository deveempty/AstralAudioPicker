const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const {chromium}=require(path.join(require('node:os').homedir(),'.codex/skills/unslop/node_modules/playwright-core'));
(async()=>{
 await esbuild.build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{ChakraProvider,Box}from'@chakra-ui/react';import{system}from'./src/theme';import{I18nProvider}from'./src/i18n';import AudioRepair from'./src/components/AudioRepair';createRoot(document.getElementById('root')).render(<ChakraProvider value={system}><I18nProvider><Box bg="#08090c" color="white" p="6" minH="100vh"><AudioRepair onChecked={()=>window.calls.push('scan')}/></Box></I18nProvider></ChakraProvider>)`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',format:'iife',outfile:'output/audio-repair-ui.js',define:{'process.env.NODE_ENV':'"development"'}});
 const bundle=fs.readFileSync('output/audio-repair-ui.js','utf8'),browser=await chromium.launch({headless:true});
 try{for(const lang of ['en','es']){
  const page=await browser.newPage({viewport:{width:980,height:650}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://repair.test/**',route=>route.fulfill({contentType:route.request().url().endsWith('.js')?'application/javascript':'text/html',body:route.request().url().endsWith('.js')?bundle:'<!doctype html><div id="root"></div><script src="/bundle.js"></script>'}));
  await page.addInitScript(lang=>{localStorage.setItem('astral-audio.language.v1',lang);window.calls=[];window.result={ok:false,code:'APO_CHAIN_UNCONFIRMED'};window.electronAPI={openEapoDeviceSelector:async()=>{window.calls.push('open');return true},finishAudioRepair:async()=>{window.calls.push('verify');return window.result}}},lang);
  await page.goto('http://repair.test/');await page.getByRole('button').click();
  const verify=page.getByRole('button',{name:lang==='es'?'Reparar automáticamente':'Repair automatically'});
  assert(!await verify.isDisabled());
  await verify.click();await page.getByText('AA-301',{exact:false}).waitFor();
  await page.evaluate(()=>window.result={ok:true,active:true});await verify.click();await page.getByRole('status').waitFor();assert.equal(await page.getByRole('alert').count(),0);
  assert.deepEqual(await page.evaluate(()=>window.calls),['verify','scan','verify','scan']);assert.deepEqual(errors,[]);
  await page.screenshot({path:`output/audio-repair-${lang}.png`});await page.close();
 }console.log('PASS: EN/ES automatic repair without requiring the selector, AA-301 failure, retry, success and diagnostics refresh. All device operations mocked.');}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
