import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {safeStorage} from 'electron'
export function createAudioDevice(directory:string){
 let clockOffset=0
 let pending:Promise<{hwid:string;privateKey:crypto.KeyObject;publicKey:string}>|undefined
 const read=()=>pending??=(async()=>{
  const {stdout}=await promisify(execFile)('reg.exe',['query','HKLM\\SOFTWARE\\Microsoft\\Cryptography','/v','MachineGuid','/reg:64'],{windowsHide:true,timeout:10000})
  const guid=stdout.match(/MachineGuid\s+REG_SZ\s+([a-f0-9-]{36})/i)?.[1];if(!guid)throw Error('DEVICE_UNAVAILABLE')
  const hwid=crypto.createHash('sha256').update('astral-audio-v1:'+guid.toLowerCase()).digest('hex')
  if(!safeStorage.isEncryptionAvailable())throw Error('ENCRYPTION_UNAVAILABLE')
  const file=path.join(directory,'audio-device.encrypted');let pem:string
  try{pem=safeStorage.decryptString(await fs.readFile(file))}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;const pair=crypto.generateKeyPairSync('ed25519');pem=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString();await fs.mkdir(directory,{recursive:true});await fs.writeFile(file,safeStorage.encryptString(pem),{flag:'wx'})}
  const privateKey=crypto.createPrivateKey(pem),publicKey=crypto.createPublicKey(privateKey).export({format:'der',type:'spki'}).subarray(-32).toString('hex')
  return {hwid,privateKey,publicKey}
 })().catch(e=>{pending=undefined;throw e})
 return {syncClock:(serverDate:string|null)=>{const timestamp=Date.parse(serverDate??'');if(!Number.isFinite(timestamp))return false;clockOffset=timestamp-Date.now();return true},headers:async()=>{const d=await read(),stamp=String(Date.now()+clockOffset),nonce=crypto.randomBytes(16).toString('hex');return {'X-Audio-HWID':d.hwid,'X-Audio-Key':d.publicKey,'X-Audio-Time':stamp,'X-Audio-Nonce':nonce,'X-Audio-Signature':crypto.sign(null,Buffer.from(`${d.hwid}\n${stamp}\n${nonce}`),d.privateKey).toString('hex')}}}
}
