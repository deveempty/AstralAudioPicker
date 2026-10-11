import {useEffect,useState} from 'react'
import {useI18n,type TranslationKey} from '../i18n'
import type {PluginSnapshot} from '../../shared/plugin-control'
import {cosmicAudioStatus} from './cosmic-audio-status'
export default function CosmicAudioStatus(){
 const {t}=useI18n(),[snapshot,setSnapshot]=useState<PluginSnapshot|null>(null)
 useEffect(()=>{let alive=true,pending=false;const poll=async()=>{if(pending)return;pending=true;try{const r=await window.electronAPI.getPluginControl();if(alive)setSnapshot(r.success?r.snapshot:null)}catch{if(alive)setSnapshot(null)}finally{pending=false}};void poll();const timer=setInterval(()=>void poll(),600);return()=>{alive=false;clearInterval(timer)}},[])
 const info=snapshot?cosmicAudioStatus(snapshot):null,evidence=info?.observed?.evidence
 const peak=(value:number|undefined)=>!evidence?t('plugin.unconfirmed'):value!==undefined&&value>1e-5?(20*Math.log10(value)).toFixed(1)+' dBFS':t('plugin.silence')
 return <div className="cosmic-footer-meters" aria-label={t('cosmic.audioStatus')} title={t('plugin.evidenceHelp')}>
  <div className="cosmic-footer-cell cosmic-footer-engine"><span>{t('cosmic.audioStatus')}</span><strong>{t((info?.statusKey??'plugin.noEvidence') as TranslationKey)}</strong></div>
  <div className="cosmic-footer-cell cosmic-footer-peaks"><span>{t('plugin.input')}</span><strong>{peak(evidence?.input)}</strong><span>{t('plugin.output')}: <b>{peak(evidence?.output)}</b></span></div>
  {[4,5,6].map((page,i)=>{const label=!info?.synced?'plugin.unconfirmed':!info.enabled[i]?'plugin.stageOff':info.observed?.modules[i]!==1?'plugin.modulesMissing':evidence!.input<1e-5?'plugin.silence':evidence!.delta[i]>1e-5?'plugin.measured':'plugin.noChange';return <div className="cosmic-footer-cell" key={page}><span>{t(('plugin.page.'+page) as TranslationKey)}</span><strong>{t(label,{amount:Math.min(999,(evidence?.delta[i]??0)*100).toFixed(1)})}</strong></div>})}
 </div>
}
