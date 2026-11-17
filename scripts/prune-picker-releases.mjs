import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const prefix='picker/stable/';
const pattern=/^picker\/stable\/Astral-Audio-Picker-Setup-((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\.exe(?:\.blockmap)?$/;
const compare=(a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);return x[0]-y[0]||x[1]-y[1]||x[2]-y[2]};
export function retentionPlan(objects,current){
  if(!pattern.test(`${prefix}Astral-Audio-Picker-Setup-${current}.exe`))throw Error('Retention requires a stable semantic version');
  const keys=new Set(objects.map(o=>o.key));
  const setup=v=>`${prefix}Astral-Audio-Picker-Setup-${v}.exe`;
  if(!keys.has(setup(current))||!keys.has(setup(current)+'.blockmap'))throw Error('Current release is incomplete; nothing will be deleted');
  const versions=[...new Set([...keys].map(k=>k.match(pattern)?.[1]).filter(Boolean))];
  const previous=versions.filter(v=>compare(v,current)<0 && keys.has(setup(v))).sort((a,b)=>compare(b,a)).slice(0,2);
  const keep=new Set([current,...previous]);
  const remove=[...keys].filter(k=>{const v=k.match(pattern)?.[1];return v&&compare(v,current)<0&&!keep.has(v)});
  return {keep:[...keep],remove};
}

export async function listObjects(request,base,objectPrefix){
  const objects=[],seen=new Set();let cursor;
  do {
    const query=new URLSearchParams({prefix:objectPrefix,per_page:'1000'});
    if(cursor)query.set('cursor',cursor);
    const page=await request(`${base}?${query}`);
    if(!Array.isArray(page.result))throw Error('Invalid R2 inventory');
    objects.push(...page.result);
    if(!page.result_info?.is_truncated)break;
    cursor=page.result_info.cursor;
    if(!cursor||seen.has(cursor))throw Error('Incomplete R2 pagination; cleanup stopped');
    seen.add(cursor);
  }while(true);
  return objects;
}

async function main(){
  const args=process.argv.slice(2);
  if(args.some(a=>!['--apply','--dry-run'].includes(a))||args.length>1)throw Error('Use --dry-run or --apply');
  const root=fileURLToPath(new URL('..',import.meta.url));
  const worker=path.resolve(root,'../AstralAudio/cloudflare-worker');
  // Capture credentials in memory only. Wrangler refreshes its own login if needed.
  const token=process.env.CLOUDFLARE_API_TOKEN||JSON.parse(execSync('npx --offline wrangler auth token --json',{cwd:worker,encoding:'utf8',stdio:['ignore','pipe','pipe']})).token;
  if(!token)throw Error('No Cloudflare authentication');
  async function request(route,method='GET'){
    const r=await fetch('https://api.cloudflare.com/client/v4'+route,{method,headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)});
    if(!r.ok)throw Error(`R2 ${method} failed (${r.status}); cleanup stopped`);
    const body=await r.json();if(!body.success)throw Error('R2 request rejected; cleanup stopped');return body;
  }
  let account=process.env.CLOUDFLARE_ACCOUNT_ID;
  if(!account){const accounts=(await request('/accounts?per_page=50')).result;if(accounts.length!==1)throw Error('Set CLOUDFLARE_ACCOUNT_ID to select the release account');account=accounts[0].id}
  if(!/^[a-f0-9]{32}$/i.test(account))throw Error('Invalid account ID');
  const base=`/accounts/${account}/r2/buckets/astral-audio/objects`;
  const latest=fs.readFileSync(path.join(root,'release/latest.yml'));
  const current=latest.toString().match(/^version:\s*([\d.]+)\s*$/m)?.[1];
  if(!current)throw Error('Invalid local release metadata');
  const digest=createHash('md5').update(latest).digest('hex');
  async function verifyFeed(){
    const items=await listObjects(request,base,prefix+'latest.yml');
    const feed=items.find(o=>o.key===prefix+'latest.yml');
    if(!feed||feed.etag?.replaceAll('"','')!==digest||feed.size!==latest.length)throw Error('Remote latest.yml differs from this release; nothing further will be deleted');
  }
  await verifyFeed();
  const objects=await listObjects(request,base,prefix+'Astral-Audio-Picker-Setup-');
  const plan=retentionPlan(objects,current);
  for(const suffix of ['.exe','.exe.blockmap']){
    const name=`Astral-Audio-Picker-Setup-${current}${suffix}`;
    if(objects.find(o=>o.key===prefix+name)?.size!==fs.statSync(path.join(root,'release',name)).size)throw Error('Published artifact size mismatch; cleanup stopped');
  }
  console.log(JSON.stringify({mode:args.includes('--apply')?'apply':'dry-run',...plan},null,2));
  if(args.includes('--apply'))for(const key of plan.remove){
    await verifyFeed();
    await request(`${base}/${encodeURIComponent(key)}`,'DELETE');
    console.log(`Removed ${key}`);
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1});
