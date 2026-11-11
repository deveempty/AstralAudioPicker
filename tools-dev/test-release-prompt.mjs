import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chooseRequired} from '../scripts/release.mjs';
const context=answers=>({interactive:true,ask:async()=>answers.shift(),log:()=>{}});
test('normal by default, mandatory only explicitly selected',async()=>{
  assert.equal(await chooseRequired([],context([''])),false);
  assert.equal(await chooseRequired([],context(['1'])),false);
  assert.equal(await chooseRequired([],context(['2'])),true);
  assert.equal(await chooseRequired([],context(['bad','2'])),true);
});
test('cancel, invalid arguments and unattended release cannot start publishing',async()=>{
  await assert.rejects(chooseRequired([],context(['q'])),/cancelado/);
  await assert.rejects(chooseRequired([],{interactive:false}),/Sin terminal/);
  await assert.rejects(chooseRequired(['--required','--optional'],context([])),/Usa/);
  await assert.rejects(chooseRequired(['--unknown'],context([])),/Usa/);
});
test('explicit flags support automation and dry runs',async()=>{
  assert.equal(await chooseRequired(['--required','--dry-run'],{interactive:false}),true);
  assert.equal(await chooseRequired(['--optional'],{interactive:false}),false);
});
