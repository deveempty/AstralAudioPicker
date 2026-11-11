import { useEffect, useState } from 'react'
import { FiArrowUp, FiX } from 'react-icons/fi'
import { useI18n } from '../i18n'
import type { UpdateStatus } from '../types/electron'
import './picker-update-banner.css'

const preview = import.meta.env.DEV
export default function PickerUpdateBanner() {
  const { t } = useI18n()
  const [status, setStatus] = useState<UpdateStatus>(preview ? {phase:'available',version:__APP_VERSION__} : {phase:'idle'})
  const [dismissed, setDismissed] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (preview) return
    let active = true, received = false
    const unsubscribe = window.electronAPI.onPickerUpdateStatus(next => { received = true; if(active) setStatus(current => ({...next,version:next.version ?? current.version})) })
    void window.electronAPI.getPickerUpdateStatus().then(next => { if(active && !received) setStatus(next) }).catch(() => {})
    return () => { active = false; unsubscribe() }
  }, [])
  useEffect(() => { setDismissed(false) }, [status.version, status.phase])
  useEffect(() => {
    if (!preview || status.phase !== 'downloading') return
    const timer = setInterval(() => setStatus(current => {
      const progress = Math.min(100, (current.progress ?? 0) + 10)
      return {...current,progress,phase:progress === 100 ? 'downloaded' : 'downloading'}
    }), 250)
    return () => clearInterval(timer)
  }, [status.phase])
  const downloaded = status.phase === 'downloaded'
  const downloading = status.phase === 'downloading'
  if (dismissed || !['available','downloading','downloaded'].includes(status.phase)) return null
  const progress = Math.max(0, Math.min(100, status.progress ?? 0))
  const click = async () => {
    if (preview) { setStatus({phase:downloaded?'available':'downloading',version:__APP_VERSION__,progress:0}); return }
    if (!downloaded || installing) return
    setInstalling(true);setFailed(false)
    try { if(!await window.electronAPI.installPickerUpdate()) setFailed(true) } catch { setFailed(true) }
    finally { setInstalling(false) }
  }
  return <aside className="astral-update-banner" aria-live="polite">
    <div className="astral-update-mark" aria-hidden="true"><FiArrowUp/></div>
    <div className="astral-update-copy">
      <span>{preview ? t('update.preview') : t(downloaded?'update.downloaded':'update.available')}</span>
      <strong>{t(downloaded?'update.bannerReady':'update.bannerAvailable',{version:status.version ?? ''})}</strong>
      {downloading && <div className="astral-update-progress" role="progressbar" aria-label={t('update.downloading',{progress})} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{width:`${progress}%`}}/><small>{progress}%</small></div>}
      {failed && <span role="alert">{t('update.error')}</span>}
    </div>
    <div className="astral-update-actions">
      <button type="button" className="astral-update-primary" disabled={installing || downloading || (!preview && !downloaded)} onClick={()=>void click()}>{t(downloading?'update.bannerDownloading':downloaded?(preview?'update.previewRestart':'update.installRestart'):(preview?'update.previewDownload':'update.bannerPreparing'))}</button>
      {!downloading && <button type="button" className="astral-update-dismiss" aria-label={t('update.dismiss')} onClick={()=>setDismissed(true)}><FiX/></button>}
    </div>
  </aside>
}
