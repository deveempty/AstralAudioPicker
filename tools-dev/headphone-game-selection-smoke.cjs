const fs=require('fs'),path=require('path'),assert=require('assert/strict'),esbuild=require('esbuild');
const root=path.resolve('output/headphone-game-'+Date.now());fs.mkdirSync(root,{recursive:true});esbuild.buildSync({entryPoints:['electron/v5-game-eq.ts'],bundle:true,platform:'node',outfile:path.join(root,'helpers.cjs')});const h=require(path.join(root,'helpers.cjs'));
const make=(name,source,target)=>{const file=path.join(root,name);fs.writeFileSync(file,`# Source file: ${source}\n# Target: ${target}\nPreamp: 0 dB`);return file};
const legacy=make('legacy.txt','same/headphone.txt','Target V2'),bo7=make('bo7.txt','same/headphone.txt','BO7 Target V5'),mw4=make('mw4.txt','same/headphone.txt','MW4 Target V5'),other=make('other.txt','other/headphone.txt','Target V3');
assert.equal(h.selectedHeadphone(null,[legacy,legacy]),legacy);assert.equal(h.selectedHeadphone(null,[legacy,other]),null);assert.equal(h.selectedHeadphone(mw4,[legacy,other]),mw4);
assert.equal(h.gameEqForHeadphone(legacy,root,'BO7'),bo7);assert.equal(h.gameEqForHeadphone(legacy,root,'MW4'),mw4);assert.equal(h.gameEqForHeadphone(mw4,root,'BO7'),bo7);assert.equal(h.gameEqForHeadphone(other,root,'MW4'),null);
const duplicate=make('duplicate.txt','same/headphone.txt','MW4 Target V5');assert.equal(h.gameEqForHeadphone(legacy,root,'MW4'),null);fs.unlinkSync(duplicate);
assert.equal(h.selectedHeadphone(root,[legacy]),legacy);
console.log('PASS: selected headphone recovery, BO7/MW4 automatic matching, priority, ambiguity, missing EQ and directory input.');
