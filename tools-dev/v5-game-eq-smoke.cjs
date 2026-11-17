const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
(async()=>{
 const root=path.resolve('output/game-eq-test');fs.mkdirSync(root,{recursive:true});
 await esbuild.build({entryPoints:['electron/v5-game-eq.ts'],bundle:true,platform:'node',outfile:path.join(root,'matcher.cjs')});
 const {matchingGameEq}=require(path.join(root,'matcher.cjs'));
 const dir=fs.mkdtempSync(path.join(root,'case-'));
 const write=(name,target,source)=>{const file=path.join(dir,name+'.txt');fs.writeFileSync(file,`# Target: ${target}\n# Source file: ${source}\nFilter 1: ON PK Fc 100 Hz Gain 1 dB Q 1\n`);return file};
 const bo7=write('bo7','BO7 Target V5','reviewer/headphone.txt');
 write('wrong-reviewer','MW4 Target V5','other/headphone.txt');
 write('old-target','MW4 Target V1','reviewer/headphone.txt');
 assert.equal(matchingGameEq(bo7,'MW4'),null);
 const mw4=write('mw4','MW4 Target V5','reviewer/headphone.txt');
 assert.equal(matchingGameEq(bo7,'MW4'),mw4);
 assert.equal(matchingGameEq(mw4,'BO7'),bo7);
 assert.equal(matchingGameEq(mw4,'MW4'),mw4);
 write('ambiguous','MW4 Target V5','reviewer/headphone.txt');assert.equal(matchingGameEq(bo7,'MW4'),null);
 assert.equal(matchingGameEq(path.join(dir,'missing.txt'),'MW4'),null);
 console.log('PASS: game target and measurement matching, BO7 restoration, missing/old/wrong-source/ambiguous EQ rejected.');
})().catch(e=>{console.error(e);process.exitCode=1});
