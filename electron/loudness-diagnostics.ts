import {readLoudness16} from './loudness16'
import {readApoChain,verifyApoChain} from './apo-chain'
import type {DiagnosticCheck} from '../shared/diagnostics'

/** Read-only: checking diagnostics never enables effects or restarts audio. */
export async function loudnessChecks(read=readLoudness16,readChain=readApoChain):Promise<DiagnosticCheck[]>{
 const [leq,apo]=await Promise.allSettled([read(),readChain()])
 const paths=['CABLE In 16ch']
 const mismatch=leq.status==='fulfilled'&&apo.status==='fulfilled'&&leq.value.deviceId.toLowerCase()!==apo.value.deviceId.toLowerCase()
 let chainValid=false
 if(apo.status==='fulfilled'&&!mismatch){try{verifyApoChain(apo.value);chainValid=true}catch{/* Report the failed chain independently of the flag. */}}
 const checks:DiagnosticCheck[]=[]
 if(leq.status==='rejected'||mismatch){checks.push({id:'loudness',status:'unknown',detail:'loudnessUnavailable',paths})}
 else{
  const enabled=leq.value.enabled&&!(apo.status==='fulfilled'&&apo.value.disabled)
  const confirmed=chainValid&&apo.status==='fulfilled'&&apo.value.active
  checks.push({id:'loudness',status:enabled&&confirmed?'ok':'warning',detail:!enabled?'loudnessDisabled':confirmed?'loudnessEnabled':'loudnessUnconfirmed',paths,values:{release:leq.value.releaseTime/20+1}})
 }
 checks.push({id:'loudnessChain',status:apo.status==='rejected'||mismatch?'unknown':!chainValid||apo.value.disabled||!apo.value.active?'warning':'ok',
  detail:apo.status==='rejected'||mismatch?'loudnessChainUnavailable':!chainValid?'loudnessChainIncomplete':apo.value.disabled?'loudnessEnhancementsDisabled':!apo.value.active?'loudnessEndpointDisabled':'loudnessChainVerified',paths})
 return checks
}

export async function legacyApoCheck(readChain=readApoChain):Promise<DiagnosticCheck>{
 const paths=['Cable Input 7.1']
 try{
  const chain=await readChain('legacy');verifyApoChain(chain)
  return {id:'legacyApoChain',status:chain.disabled?'warning':'ok',detail:chain.disabled?'cableChainIncomplete':'cableChainVerified',paths}
 }catch{return {id:'legacyApoChain',status:'warning',detail:'cableChainIncomplete',paths}}
}
