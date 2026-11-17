const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const {chromium}=require(path.join(require('node:os').homedir(),'.codex/skills/unslop/node_modules/playwright-core'));
(async()=>{
 await esbuild.build({entryPoints:['tools-dev/preparation-preview.tsx'],bundle:true,platform:'browser',format:'iife',outfile:'output/preparation-ui.js',define:{'process.env.NODE_ENV':'"development"'}});
 const bundle=fs.readFileSync('output/preparation-ui.js','utf8'),browser=await chromium.launch({headless:true});
 try{for(const lang of ['en','es']){
  const page=await browser.newPage({viewport:{width:1280,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://preparation.test/**',route=>route.fulfill({contentType:route.request().url().endsWith('.js')?'application/javascript':'text/html',body:route.request().url().endsWith('.js')?bundle:'<!doctype html><div id="root"></div><script src="/bundle.js"></script>'}));
  await page.addInitScript(lang=>{
   localStorage.setItem('astral-audio.language.v1',lang);window.calls=[];
   window.state={phase:'content',operation:'headphones',preparation:{phase:'running',step:'headphones',completed:['snapshot','content'],percent:50,version:'3.1.15'}};
   window.electronAPI={audioUpgradeStatus:async()=>window.state,audioUpgradeRetry:async()=>{window.calls.push('retry');return window.state},openAudioSupport:async()=>window.calls.push('support'),openEapoDeviceSelector:async()=>window.calls.push('apo')};
  },lang);
  await page.goto('http://preparation.test/');await page.getByRole('dialog').waitFor();assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),'2');
  await page.waitForTimeout(2300);assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'),'2','elapsed time cannot advance real progress');
  await page.screenshot({path:`output/preparation-running-${lang}.png`});
  await page.evaluate(()=>{window.state={phase:'error',code:'APO_CHAIN_UNCONFIRMED',preparation:{phase:'error',step:'apo',completed:['snapshot','content','headphones'],version:'3.1.15'}}});
  await page.getByRole('alert').waitFor();await page.getByText('AA-301',{exact:false}).waitFor();
  await page.getByRole('button',{name:lang==='es'?'Ir a Discord':'Open Discord'}).click();await page.getByRole('button',{name:lang==='es'?'Abrir selector de APO':'Open APO selector'}).click();
  assert.deepEqual(await page.evaluate(()=>window.calls),['support','apo']);assert.deepEqual(errors,[]);
  await page.screenshot({path:`output/preparation-error-${lang}.png`});await page.close();
 }console.log('PASS: real progress does not advance on a timer, EN/ES rendering, stage failure, stable support code and explicit support/APO actions. Audio and network mocked.');}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
