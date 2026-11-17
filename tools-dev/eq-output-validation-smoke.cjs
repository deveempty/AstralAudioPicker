const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
(async()=>{
 const out=fs.mkdtempSync(path.resolve('output/eq-validation-'));
 esbuild.buildSync({entryPoints:['electron/eq-transaction.ts'],bundle:true,platform:'node',format:'cjs',outfile:path.join(out,'validator.cjs')});
 const {validateGeneratedEq}=require(path.join(out,'validator.cjs'));
 const fixture=count=>`# Source file: measurement.txt\n# Target: BO7 Target V5\n# Filter count: ${count}\nPreamp: 0.0 dB\n`+Array.from({length:count},(_,i)=>`Filter ${i+1}: ON PK Fc 100 Hz Gain 1.0 dB Q 1.0`).join('\n');
 for(const count of [0,1,8,9,10,11,16])for(const newline of ['\n','\r\n'])validateGeneratedEq(fixture(count).replaceAll('\n',newline));
 for(const invalid of [fixture(9).replace('count: 9','count: 10'),fixture(1).replace('Q 1.0','Q 0'),fixture(1).replace('Gain 1.0','Gain NaN'),fixture(1).replace('Preamp: 0.0','Preamp: Infinity'),fixture(2).replace('Filter 2:','Filter 1:'),fixture(0).replace('# Filter count: 0\n',''),fixture(0).replace('Preamp: 0.0','Preamp: -3.0'),fixture(1)+'\nInclude: arbitrary.txt'])assert.throws(()=>validateGeneratedEq(invalid),/AUTO_EQ_OUTPUT_INVALID/);
 console.log('PASS: variable/zero filter counts, CRLF/LF, declared-count mismatch, non-finite values, invalid Q, repeated bands and unexpected directives.');
 if(process.argv.includes('--arete')){
  const data=path.join(process.env.LOCALAPPDATA,'AstralAudio'),measurements=path.join(data,'measurements');
  await esbuild.build({entryPoints:['electron/v5-presets.ts'],bundle:true,platform:'node',format:'cjs',outfile:path.join(out,'presets.cjs'),plugins:[{name:'isolated',setup(b){b.onResolve({filter:/astral-paths$/},()=>({path:'paths',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export const EQUALIZER_APO_CONFIG=${JSON.stringify(out)};export const ASTRAL_APP_DATA=${JSON.stringify(path.join(out,'app-data'))};export const findTargetsLibrary=()=>${JSON.stringify(path.join(data,'targets'))};export const findMeasurementsLibrary=()=>${JSON.stringify(measurements)};export const findV5Library=()=>null;export const PLUGIN_PATHS={};`,loader:'js'}))}}]});
  const api=require(path.join(out,'presets.cjs'));
  const generated=await api.generateBothGameEqs(path.join(measurements,'Squiglink/Gadgetry Tech/ZiiGaat/ZiiGaat x Fresh Reviews Arete.txt'),'MW4');assert(generated);
  const files=['v2','v3','v5'].flatMap(version=>fs.readdirSync(path.join(out,'data/eq',version)).map(name=>path.join(out,'data/eq',version,name)));assert.equal(files.length,4);
  for(const file of files)validateGeneratedEq(fs.readFileSync(file,'utf8'));
  assert(files.some(file=>(fs.readFileSync(file,'utf8').match(/^Filter /gm)||[]).length===9));
  console.log('PASS: actual Arete / Gadgetry Tech measurement generated and committed all four EQs in an isolated folder, including valid 9-band results. Installed EQs were not modified.');
 }
})().catch(error=>{console.error(error);process.exitCode=1});
