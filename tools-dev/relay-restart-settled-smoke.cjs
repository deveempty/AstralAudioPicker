const assert=require('node:assert/strict'),esbuild=require('esbuild');
esbuild.buildSync({entryPoints:['electron/voicemeeter.ts'],bundle:true,platform:'node',format:'cjs',external:['koffi'],outfile:'output/apo-lab/relay-settled.cjs'});
const {relayRestartSettled}=require('../output/apo-lab/relay-settled.cjs');
const before={connected:true,edition:1,strips:[{name:'Cable',gain:0,mute:false},{name:'',gain:-3,mute:true}],bus:{name:'Headphones',gain:0,mute:false},settings:{sr:48000,wdm:256}};
assert.equal(relayRestartSettled(before,structuredClone(before)),true);
for(const mutate of [s=>s.connected=false,s=>s.bus.gain=-60,s=>s.bus.mute=true,s=>s.bus.name='Other',s=>s.strips[1].mute=false,s=>s.strips[0].gain=-10,s=>s.settings.sr=44100,s=>s.settings.wdm=512,s=>s.edition=2]){const after=structuredClone(before);mutate(after);assert.equal(relayRestartSettled(before,after),false)}
console.log('PASS: restart confirmation requires restored route, gains, mute, edition, sample rate and buffers.');
