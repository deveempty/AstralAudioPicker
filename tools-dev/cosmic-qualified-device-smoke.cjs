const fs=require('node:fs'),assert=require('node:assert/strict'),esbuild=require('esbuild');
fs.mkdirSync('output/cosmic-qualified-device',{recursive:true});
esbuild.buildSync({entryPoints:['electron/custom-output.ts','shared/audio-errors.ts'],bundle:true,platform:'node',format:'cjs',outdir:'output/cosmic-qualified-device'});
const {cosmicChain,routeCustomOutput,customOutputActive}=require('../output/cosmic-qualified-device/electron/custom-output.js');
const {audioError}=require('../output/cosmic-qualified-device/shared/audio-errors.js');
const device='Device: CABLE In 16ch VB-Audio Virtual Cable {11111111-2222-3333-4444-555555555555}';
const unrelated='\n# User settings\nInclude: user-eq.txt\n';
for(const active of [true,false])for(const newline of ['\n','\r\n']){
 const block=cosmicChain();block[1]=device;
 const content=block.map(l=>active?l:'# '+l).join(newline)+newline+unrelated.replaceAll('\n',newline);
 const next=routeCustomOutput(content,active);assert(next.includes(device));assert(next.endsWith(unrelated.replaceAll('\n',newline)));assert.equal(customOutputActive(next),active);assert.equal(routeCustomOutput(next,active),next);
 const switched=routeCustomOutput(next,!active);assert(switched.includes(device));assert.equal(customOutputActive(switched),!active);
}
assert.equal(routeCustomOutput(routeCustomOutput('',false),false),routeCustomOutput('',false));
for(const selector of ['Device: ALL','Device: Cable Input 7.1',device+' extra',device.replace('VB-Audio','Realtek'),device.replace('11111111','INVALID')]){
 const bad=cosmicChain();bad[1]=selector;assert.throws(()=>routeCustomOutput(bad.join('\n'),true),/AMBIGUOUS_RECONCILIATION/);
}
const a=cosmicChain(),b=cosmicChain();a[1]=device;b[1]=device.replace('11111111','99999999');assert.throws(()=>routeCustomOutput(a.concat(b).join('\n'),true),/AMBIGUOUS_RECONCILIATION/);
const changed=cosmicChain();changed[1]=device;changed[4]='Preamp: -12 dB';assert.throws(()=>routeCustomOutput(changed.join('\n'),true),/AMBIGUOUS_RECONCILIATION/);
assert.equal(audioError('AMBIGUOUS_RECONCILIATION').code,'AA-103');
// Read-only reproduction of the reported failure on this development PC.
const livePath='C:/Program Files/EqualizerAPO/config/config.txt';
if(process.argv.includes('--live-config')&&fs.existsSync(livePath)){const content=fs.readFileSync(livePath,'utf8'),next=routeCustomOutput(content,customOutputActive(content));assert.equal(next,content,'reported installed configuration needs no rewrite');console.log('PASS: current PC config accepted without changing a byte.');}
console.log('PASS: qualified endpoint retained, active/inactive, LF/CRLF, idempotence, foreign devices and conflicting blocks rejected, friendly support code. No live writes.');
