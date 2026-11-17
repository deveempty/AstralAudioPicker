import fs from 'node:fs'
import path from 'node:path'
import {randomUUID,createHash} from 'node:crypto'

const hash=(data:Buffer)=>createHash('sha256').update(data).digest('hex')
export function validateGeneratedEq(text:string){
 const fail=(reason:string):never=>{throw new Error('AUTO_EQ_OUTPUT_INVALID',{cause:{reason}})}
 const lines=text.split(/\r?\n/).map(line=>line.trim())
 if(!lines.some(line=>/^# Source file: .+$/.test(line))||!lines.some(line=>/^# Target: (BO7|MW4) Target V[235]$/.test(line)))fail('metadata')
 const active=lines.filter(line=>line&&!line.startsWith('#'))
 const number='(-?\\d+(?:\\.\\d+)?)'
 const preamp=new RegExp('^Preamp: '+number+' dB$').exec(active[0]??'')
 if(!preamp||!Number.isFinite(Number(preamp[1])))fail('preamp')
 const filters=active.slice(1)
 const declared=lines.find(line=>/^# Filter count: /.test(line))?.slice('# Filter count: '.length)
 if(declared!==undefined&&declared!==String(filters.length))fail('incomplete-output')
 // The optimizer decides the band count. Compare its declaration only to
 // detect truncated output, never to impose a fixed count or ceiling.
 // A zero-band result must be explicitly declared with unity gain.
 if(!filters.length&&(declared!=='0'||Number(preamp![1])!==0))fail('empty-correction')
 const pattern=new RegExp('^Filter (\\d+): ON PK Fc '+number+' Hz Gain '+number+' dB Q '+number+'$')
 for(const [index,line] of filters.entries()){
  const match=pattern.exec(line)
  if(!match)fail('filter-syntax')
  const [id,fc,gain,q]=match!.slice(1).map(Number)
  if(id!==index+1||![fc,gain,q].every(Number.isFinite)||fc<=0||fc>=24000||q<=0)fail('filter-values')
 }
}
/** A write-ahead journal survives process termination; only listed EQ files change. */
export function commitEqFiles(files:Array<{target:string;data:Buffer}>,root:string,journalRoot:string){
 const base=path.resolve(root)+path.sep
 const safe=(file:string)=>{if(!path.resolve(file).toLowerCase().startsWith(base.toLowerCase())||!file.endsWith('.txt'))throw Error('AUTO_EQ_UNSAFE_PATH');for(let p=path.resolve(file);p.length>=base.length;p=path.dirname(p)){if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw Error('AUTO_EQ_UNSAFE_PATH')}}
 fs.mkdirSync(journalRoot,{recursive:true})
 const journal=path.join(journalRoot,'transaction.json')
 type Record={target:string;backup:string|null;hash:string}
 function rollback(records:Record[]){for(const record of [...records].reverse()){safe(record.target);if(record.backup){if(path.dirname(record.backup)!==journalRoot)throw Error('AUTO_EQ_UNSAFE_PATH');fs.copyFileSync(record.backup,record.target)}else if(fs.existsSync(record.target)){if(hash(fs.readFileSync(record.target))!==record.hash)throw Error('AUTO_EQ_ROLLBACK_CONFLICT');fs.unlinkSync(record.target)}}}
 if(fs.existsSync(journal)){
  const old=JSON.parse(fs.readFileSync(journal,'utf8')) as {completed:boolean;records:Record[]}
  if(!old.completed)rollback(old.records)
  fs.renameSync(journal,path.join(journalRoot,randomUUID()+'.json'))
 }
 const seen=new Set<string>()
 for(const file of files){safe(file.target);validateGeneratedEq(file.data.toString('utf8'));if(seen.has(file.target.toLowerCase()))throw Error('AUTO_EQ_DUPLICATE_OUTPUT');seen.add(file.target.toLowerCase())}
 const records:Record[]=[]
 const save=(completed=false)=>{fs.writeFileSync(journal+'.tmp',JSON.stringify({completed,records}));fs.renameSync(journal+'.tmp',journal)}
 try{
  for(const file of files){
   fs.mkdirSync(path.dirname(file.target),{recursive:true})
   const backup=fs.existsSync(file.target)?path.join(journalRoot,randomUUID()+'.backup'):null
   if(backup)fs.copyFileSync(file.target,backup)
   records.push({target:file.target,backup,hash:hash(file.data)});save()
   const temp=file.target+'.'+randomUUID()+'.tmp'
   try{fs.writeFileSync(temp,file.data);fs.renameSync(temp,file.target)}finally{if(fs.existsSync(temp))fs.unlinkSync(temp)}
   if(hash(fs.readFileSync(file.target))!==hash(file.data))throw Error('AUTO_EQ_READBACK_FAILED')
  }
  save(true)
 }catch(error){try{rollback(records);save(true)}catch{throw Error('AUTO_EQ_ROLLBACK_INCOMPLETE')}throw error}
}
