import {AudioAccountContext} from './AccountSidebar'
import wordmark from '../assets/astral-tweaks-logo.png'
import {FiArrowRight} from 'react-icons/fi'
import {useEffect,useState,type ReactNode} from 'react'
import AstralButton from './ui/AstralButton'
import {useI18n,type TranslationKey} from '../i18n'
import type {AudioAccessStatus} from '../../shared/audio-access'
export default function AudioAccessGate({children}:{children:ReactNode}){
 const {t}=useI18n(),[state,setState]=useState<AudioAccessStatus>({phase:'checking'}),[busy,setBusy]=useState(false)
 useEffect(()=>{let alive=true,pending=false;const poll=async()=>{if(pending)return;pending=true;try{const s=await window.electronAPI.audioAccessStatus();if(alive)setState(s)}catch{if(alive)setState({phase:'error',code:'AUTH_UNAVAILABLE'})}finally{pending=false}};void poll();const timer=setInterval(()=>void poll(),500);return()=>{alive=false;clearInterval(timer)}},[])
 const run=async(kind:'login'|'retry'|'logout')=>{if(busy)return;setBusy(true);try{setState(await (kind==='login'?window.electronAPI.audioAccessLogin():kind==='retry'?window.electronAPI.audioAccessRetry():window.electronAPI.audioAccessLogout()))}catch{setState({phase:'error',code:'AUTH_UNAVAILABLE'})}finally{setBusy(false)}}
 if(state.phase==='ready')return <AudioAccountContext.Provider value={{state,busy,logout:()=>void run('logout')}}>{children}</AudioAccountContext.Provider>
 const code=state.code==='DISCORD_RATE_LIMITED'?'rateLimited':state.code==='DEVICE_CLOCK_SKEW'?'clockSkew':state.code==='DEVICE_PROOF_INVALID'?'deviceProof':state.code==='SERVICE_NOT_READY'?'servicePending':state.code==='CALLBACK_UNAVAILABLE'?'callbackBusy':state.code==='HWID_MISMATCH'?'hwid':state.code==='ROLE_REQUIRED'?'role':state.code==='EPERM'||state.code==='EACCES'||state.code?.includes('EPERM')||state.code?.includes('EACCES')?'permissions':'failed'
 const waiting=['checking','analyzing','downloading','reconciling'].includes(state.phase)
 const title=waiting?t(('audioAccess.'+state.phase) as TranslationKey):t(state.username?'audioAccess.prepareTitle':busy?'login.waiting':'login.title')
 return <main className="audio-login-shell">
  <section className="audio-login-panel" aria-labelledby="audio-login-title" aria-busy={waiting||busy}>
   <img className="audio-login-wordmark" src={wordmark} alt="Astral Tweaks"/>
   <span className="audio-login-eyebrow">{t('login.eyebrow')}</span>
   <h1 id="audio-login-title" role="status" aria-live="polite">{title}</h1>
   <p>{t(state.username?'audioAccess.prepareHelp':'login.description')}</p>
   {state.phase==='error'?<div className="audio-login-error" role="alert">{t(state.code==='DISCORD_RATE_LIMITED'?'audioAccess.rateLimited':state.code==='ROLE_REQUIRED'?'audioAccess.role':state.code==='HWID_MISMATCH'?'audioAccess.hwid':state.username?'audioAccess.prepareFailed':('audioAccess.'+code) as TranslationKey)}{state.code&&state.code!=='ROLE_REQUIRED'&&/^[A-Z][A-Z0-9_]{1,63}$/.test(state.code)?<small style={{display:'block',marginTop:8}}>{state.stage} / {state.code}</small>:null}</div>:null}
   {state.phase==='error'&&state.code==='ROLE_REQUIRED'?<p className="audio-login-ticket-help">{t('audioAccess.previousCustomer')}</p>:null}
   <div className="audio-login-actions">
    {!state.username?<AstralButton disabled={waiting||busy} icon={<FiArrowRight aria-hidden="true"/>} onClick={()=>void run('login')}>{t(busy?'login.waiting':'audioAccess.login')}</AstralButton>:null}
    {state.phase==='error'?<AstralButton disabled={busy} variant="ghost" onClick={()=>void run('retry')}>{t('audioAccess.retry')}</AstralButton>:null}
   </div>
   <small>{t('login.privacy')}</small>
  </section>
 </main>
}
