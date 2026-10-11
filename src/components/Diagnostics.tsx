import {useEffect,useRef,useState} from 'react'
import {FiCheckCircle,FiAlertCircle,FiHelpCircle,FiRefreshCw} from 'react-icons/fi'
import AstralButton from './ui/AstralButton'
import {useI18n,type TranslationKey} from '../i18n'
import type {DiagnosticReport} from '../../shared/diagnostics'
export default function Diagnostics(){
 const {t,language}=useI18n(),[report,setReport]=useState<DiagnosticReport|null>(null),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false),alive=useRef(true),running=useRef(false)
 const scan=async()=>{if(running.current)return;running.current=true;setBusy(true);setFailed(false);try{const result=await window.electronAPI.runAudioDiagnostics();if(alive.current)setReport(result)}catch{if(alive.current)setFailed(true)}finally{running.current=false;if(alive.current)setBusy(false)}}
 useEffect(()=>{alive.current=true;void scan();return()=>{alive.current=false}},[])
 const issues=report?.checks.filter(c=>c.status==='error'||c.status==='warning').length??0,unknown=report?.checks.filter(c=>c.status==='unknown').length??0
 const tr=(key:string)=>t(('diagnostics.'+key) as TranslationKey)
 return <section className="diagnostics-page" aria-busy={busy}>
  <div className="diagnostics-summary"><div><span>{tr('overview')}</span><h2 role="status">{tr(busy?'scanning':failed?'failed':!report?'idle':issues?'attention':unknown?'partial':'healthy')}</h2><p>{tr('scope')}</p>{report?<small>{tr('lastScan')} {new Date(report.checkedAt).toLocaleTimeString(language,{hour:'2-digit',minute:'2-digit',second:'2-digit'})} | {issues} {tr('issues')} | {unknown} {tr('unknown')}</small>:null}</div><AstralButton disabled={busy} icon={<FiRefreshCw/>} onClick={()=>void scan()}>{tr(busy?'scanning':'scan')}</AstralButton></div>
  {failed?<p role="alert">{tr('retryHelp')}</p>:null}
  <div className="diagnostics-list">{report?.checks.map(check=><article key={check.id} className="diagnostics-row" data-status={check.status}><div className="diagnostics-label">{check.status==='ok'?<FiCheckCircle/>:check.status==='error'||check.status==='warning'?<FiAlertCircle/>:<FiHelpCircle/>}<strong>{tr(check.id)}</strong></div><div><p>{tr(check.detail)}</p>{check.paths?.map(p=><small key={p}>{p}</small>)}</div><span className="diagnostics-badge">{tr(check.status)}</span></article>)}</div>
 </section>
}
