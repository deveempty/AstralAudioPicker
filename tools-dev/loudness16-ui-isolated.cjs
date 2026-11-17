const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const {chromium}=require(path.join(require('node:os').homedir(),'.codex/skills/unslop/node_modules/playwright-core'));
(async()=>{
 await esbuild.build({entryPoints:['tools-dev/loudness-preview.tsx'],bundle:true,platform:'browser',format:'iife',outfile:'output/loudness-ui-bundle.js',define:{'process.env.NODE_ENV':'"development"'}});
 const bundle=fs.readFileSync('output/loudness-ui-bundle.js','utf8');
 const browser=await chromium.launch({headless:true});
 try{
  for(const lang of ['en','es']){
   const page=await browser.newPage({viewport:{width:700,height:430}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('http://loudness.test/**',route=>route.fulfill({contentType:route.request().url().endsWith('.js')?'application/javascript':'text/html',body:route.request().url().endsWith('.js')?bundle:'<!doctype html><div id="root"></div><script src="/bundle.js"></script>'}));
   await page.addInitScript(lang=>{
    localStorage.setItem('astral-audio.language.v1',lang);const state={deviceId:'16ch-only',enabled:false,releaseTime:40};window.calls=[];
    window.electronAPI={getLoudness16:async()=>({...state}),setLoudness16:async change=>{window.calls.push(change);Object.assign(state,change);return {...state}}};
   },lang);
   await page.goto('http://loudness.test/');
   await page.getByRole('checkbox',{name:'Loudness EQ'}).check();await page.waitForFunction(()=>window.calls.length===1);
   await page.getByRole('slider').press('End');await page.waitForFunction(()=>window.calls.length===2);
   assert.deepEqual(await page.evaluate(()=>window.calls),[{enabled:true},{releaseTime:100}]);
   await page.getByRole('checkbox').uncheck();await page.waitForFunction(()=>window.calls.length===3);
   await page.evaluate(()=>{window.electronAPI.getLoudness16=async()=>{throw Error('read failed')};window.dispatchEvent(new Event('focus'))});
   await page.getByRole('alert').waitFor();assert.equal(await page.getByRole('checkbox').count(),0);
   await page.evaluate(()=>{window.electronAPI.getLoudness16=async()=>({deviceId:'16ch-only',enabled:true,releaseTime:20})});
   await page.getByRole('button',{name:lang==='en'?'Retry':'Reintentar',exact:true}).click();
   await page.getByRole('checkbox').waitFor();assert.equal(await page.getByRole('checkbox').isChecked(),true);
   assert.deepEqual(errors,[]);await page.screenshot({path:'output/loudness16-'+lang+'.png'});await page.close();
  }
  console.log('PASS: EN/ES toggle, slider, unknown state on read failure and Retry recovery. Browser requests and audio are mocked.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
