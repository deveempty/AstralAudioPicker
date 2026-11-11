import {useEffect,useState,type ReactNode} from 'react'
import type {UpdateStatus} from '../types/electron'
import {useI18n} from '../i18n'
import TitleBar from './TitleBar'
import AstralButton from './ui/AstralButton'
export default function RequiredUpdateGate({children}:{children:ReactNode}) {
 const preview=import.meta.env.DEV?new URLSearchParams(window.location.search).get('requiredUpdatePreview'):null
 const {t}=useI18n()
 const [status,setStatus]=useState<UpdateStatus>(preview?{phase:preview==='error'?'error':preview==='downloading'?'downloading':'downloaded',required:true,version:'3.2.0',minimumVersion:'3.2.0',progress:64}:{phase:'idle'})
 const [initial,setInitial]=useState(!import.meta.env.DEV)
 const [busy,setBusy]=useState(false)
 useEffect(()=>{
  if(import.meta.env.DEV)return
  let active=true
  const unsub=window.electronAPI.onPickerUpdateStatus(s=>{if(active)setStatus(s)})
  void window.electronAPI.checkPickerUpdates().catch(()=>{}).finally(async()=>{
   try {const s=await window.electronAPI.getPickerUpdateStatus();if(active)setStatus(s)} catch {if(active)setStatus(s=>({...s,phase:'error'}))} finally {if(active)setInitial(false)}
  })
  return()=>{active=false;unsub()}
 },[])
 const startup=initial||['idle','checking','migrating'].includes(status.phase)
 if((import.meta.env.DEV&&!preview)||(!startup&&!status.required))return children
 const waiting=startup||busy||['checking','available','downloading'].includes(status.phase)
 const run=async()=>{if(preview){setStatus(s=>({...s,phase:'downloaded'}));return}setBusy(true);try{if(status.phase==='downloaded')await window.electronAPI.installPickerUpdate();else await window.electronAPI.checkPickerUpdates()}catch{setStatus(s=>({...s,phase:'error'}))}finally{setBusy(false)}}
 return <div className="audio-shell" style={{height:'100vh',background:'#020204',color:'#f2f3f5'}}><TitleBar/><main className="audio-login-shell"><section className="audio-login-panel">
  <span className="audio-login-eyebrow">ASTRAL AUDIO</span><h1>{t(initial?'update.checking':'update.required')}</h1>
  {!initial&&<p>{t('update.requiredHelp',{version:status.version??status.minimumVersion??''})}</p>}
  {status.phase==='downloading'&&<p role="status">{t('update.downloading',{progress:status.progress??0})}</p>}
  {status.phase==='error'&&<p role="alert">{t('update.error')}</p>}
  {!initial&&<AstralButton disabled={waiting} onClick={()=>void run()}>{t(status.phase==='downloaded'?'update.installRestart':waiting?'update.bannerDownloading':'audioAccess.retry')}</AstralButton>}
 </section></main></div>
}
