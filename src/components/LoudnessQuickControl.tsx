import {useRef} from 'react'
import {FiInfo, FiX} from 'react-icons/fi'
import {useI18n, type TranslationKey} from '../i18n'
import {useLoudness16} from './Loudness16Provider'
import AstralButton from './ui/AstralButton'

export default function LoudnessQuickControl({disabled=false}:{disabled?:boolean}) {
  const {t}=useI18n()
  const {state,busy,applying,error,refresh,commit}=useLoudness16()
  const dialog=useRef<HTMLDialogElement>(null)
  return <div className="astral-loudness-quick" aria-busy={busy}>
    <div className="astral-loudness-title"><strong>Loudness EQ</strong><button type="button" aria-label={t('picker.loudnessDetails')} title={t('picker.loudnessSetting')} onClick={()=>dialog.current?.showModal()}><FiInfo/></button></div>
    <div className="astral-loudness-state">
      <span>16ch</span>
      {state?<label className="astral-quick-switch"><input type="checkbox" aria-label="Loudness EQ · 16ch" checked={state.enabled} disabled={busy||disabled} onChange={e=>void commit({enabled:e.target.checked})}/><span aria-hidden="true" className="astral-switch-track"/><strong>{t(state.enabled?'common.on':'common.off').toUpperCase()}</strong></label>:<button type="button" disabled={busy} onClick={()=>void refresh()}>{t(busy?'plugin.loading':'picker.loudnessUnavailable')}</button>}
    </div>
    {error?<button className="astral-loudness-error" type="button" onClick={()=>dialog.current?.showModal()}>{t('common.failed')} · {t('picker.loudnessDetails')}</button>:busy?<span className="astral-loudness-pending" role="status">{t(applying?'common.applying':'audio.loudness16Reading')}</span>:null}
    <dialog ref={dialog} className="astral-loudness-dialog" aria-labelledby="loudness-dialog-title" onClick={e=>{if(e.target===dialog.current)dialog.current.close()}}>
      <header><strong id="loudness-dialog-title">Loudness EQ · 16ch</strong><button type="button" aria-label={t('common.close')} onClick={()=>dialog.current?.close()}><FiX/></button></header>
      <p>{t('picker.loudnessSetting')}</p>
      {error?<p role="alert" className="astral-loudness-error">{t(error as TranslationKey)}</p>:null}
      <AstralButton disabled={busy} onClick={()=>void refresh()}>{t('upgrade.retry')}</AstralButton>
    </dialog>
  </div>
}
