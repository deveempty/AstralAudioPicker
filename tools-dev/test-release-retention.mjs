import {test} from 'node:test';
import assert from 'node:assert/strict';
import {retentionPlan,listObjects} from '../scripts/prune-picker-releases.mjs';
const key=v=>`picker/stable/Astral-Audio-Picker-Setup-${v}.exe`;
const objects=versions=>versions.flatMap(v=>[{key:key(v)},{key:key(v)+'.blockmap'}]);
test('keeps current and two previous versions in numeric order, including their blockmaps',()=>{
 const p=retentionPlan(objects(['2.3.4','3.1.8','3.1.9','3.1.10','3.1.11']),'3.1.11');
 assert.deepEqual(p.keep,['3.1.11','3.1.10','3.1.9']);assert.equal(p.remove.length,4);
});
test('never touches content, other products, metadata, previews or newer releases',()=>{
 const extra=['picker/stable/content/hash/file.exe','picker/stable/latest.yml','clipper/stable/Astral-Audio-Picker-Setup-1.0.0.exe',key('1.0.0-beta')];
 const p=retentionPlan([...objects(['1.0.0','2.0.0','3.0.0','4.0.0','5.0.0']),...extra.map(key=>({key}))],'4.0.0');
 assert.deepEqual(p.remove,[key('1.0.0'),key('1.0.0')+'.blockmap']);
});
test('incomplete current release blocks deletion; fewer previous versions are retained',()=>{
 assert.throws(()=>retentionPlan([{key:key('3.0.0')}],'3.0.0'),/incomplete/);
 assert.deepEqual(retentionPlan(objects(['1.0.0','2.0.0']),'2.0.0').remove,[]);
});
test('orphan blockmap does not displace an available previous installer',()=>{
 const p=retentionPlan([...objects(['1.0.0','2.0.0','4.0.0']),{key:key('3.0.0')+'.blockmap'}],'4.0.0');
 assert.deepEqual(p.keep,['4.0.0','2.0.0','1.0.0']);assert.deepEqual(p.remove,[key('3.0.0')+'.blockmap']);
});
test('inventory reads all pages and rejects truncated pagination without a cursor',async()=>{
 let calls=0;
 const result=await listObjects(async()=>++calls===1?{result:[{key:'a'}],result_info:{is_truncated:true,cursor:'next'}}:{result:[{key:'b'}],result_info:{is_truncated:false}},'/objects','picker/stable/');
 assert.equal(result.length,2);assert.equal(calls,2);
 await assert.rejects(listObjects(async()=>({result:[],result_info:{is_truncated:true}}),'/objects','prefix'),/pagination/);
});
