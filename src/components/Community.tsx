import { communityErrorKey as errorKey } from '../community-errors'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FiArrowUpRight, FiDownload, FiBookmark, FiHeadphones, FiPlus, FiSearch, FiUsers, FiX } from 'react-icons/fi'
import { LuWaves } from 'react-icons/lu'
import { useI18n, type TranslationKey } from '../i18n'
import { communityGames, communityFocuses, type CommunityFocus, type CommunityProfile, type CommunityResult } from '../../shared/community'
import type { SavedPluginProfile } from '../../shared/plugin-control'
import AstralButton from './ui/AstralButton'
import './community.css'


export default function Community() {
  const { t } = useI18n()
  const [tab, setTab] = useState<'explore' | 'saved' | 'mine'>('explore')
  const [search, setSearch] = useState(''), [game, setGame] = useState(''), [page, setPage] = useState(0)
  const [profiles, setProfiles] = useState<CommunityProfile[]>([]), [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [reload, setReload] = useState(0)
  const [error, setError] = useState<TranslationKey | null>(null), [notice, setNotice] = useState<TranslationKey | null>(null)
  const [selected, setSelected] = useState<CommunityProfile | null>(null), [canUndo, setCanUndo] = useState(false)
  const [sources, setSources] = useState<SavedPluginProfile[]>([]), [sourceReady, setSourceReady] = useState(false)
  const [reporting, setReporting] = useState(false), [removeConfirm, setRemoveConfirm] = useState(false)
  const detailDialog = useRef<HTMLDialogElement>(null), publishDialog = useRef<HTMLDialogElement>(null)
  const actionRunning = useRef(false), mounted = useRef(true), publishRevision = useRef(0), publishId = useRef('')
  const listQueue = useRef<Promise<void>>(Promise.resolve())
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    let cancelled = false
    setLoading(true); setError(null)
    const timer = setTimeout(() => {
      listQueue.current = listQueue.current.then(async () => {
        if (cancelled) return
        let result = await window.electronAPI.communityList({tab,search,game,page})
        for (let attempt = 0; !result.success && ['AUTH_BUSY','busy'].includes(result.code) && attempt < 3; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
          if (cancelled) return
          result = await window.electronAPI.communityList({tab,search,game,page})
        }
        if (cancelled) return
        if (result.success) {setProfiles(result.data.profiles);setMore(result.data.more)}
        else {setProfiles([]);setMore(false);setError(errorKey(result.code))}
      }).catch(() => {if (!cancelled) {setProfiles([]);setError('community.errorService')}}).finally(() => {if (!cancelled) setLoading(false)})
    }, 250)
    return () => {cancelled = true; clearTimeout(timer)}
  }, [tab, search, game, page, reload])

  const action = async <T,>(work: () => Promise<CommunityResult<T>>, done: (data: T) => void) => {
    if (actionRunning.current) return
    actionRunning.current = true; setBusy(true); setError(null); setNotice(null)
    try { const result = await work(); if (mounted.current) {if (result.success) done(result.data); else setError(errorKey(result.code))} }
    catch {if (mounted.current) setError('community.errorService')}
    finally {actionRunning.current = false; if (mounted.current) setBusy(false)}
  }
  const favorite = (profile: CommunityProfile) => action(() => window.electronAPI.communityFavorite(profile.id, !profile.saved), data => {
    setProfiles(current => current.map(p => p.id === profile.id ? {...p,saved:data.saved} : p))
    setSelected(current => current?.id === profile.id ? {...current,saved:data.saved} : current)
    if (tab === 'saved') setReload(v => v + 1)
  })
  const apply = (profile: CommunityProfile) => action(() => window.electronAPI.communityApply(profile.id), data => {
    if (data.applications !== undefined) {
      setProfiles(current => current.map(p => p.id === profile.id ? {...p,applications:data.applications} : p))
      setSelected(current => current?.id === profile.id ? {...current,applications:data.applications} : current)
    }
    setNotice(data.engineConfirmed ? 'community.applied' : 'community.appliedPending');setCanUndo(true)
    window.dispatchEvent(new Event('astral-config-changed'))
  })
  const undo = () => action(() => window.electronAPI.communityUndo(), data => {
    setNotice(data.engineConfirmed ? 'community.undone' : 'community.appliedPending');setCanUndo(false)
    window.dispatchEvent(new Event('astral-config-changed'))
  })
  const openDetails = (profile: CommunityProfile) => {setSelected(profile);setReporting(false);setRemoveConfirm(false);setError(null);setNotice(null);detailDialog.current?.showModal()}
  const openPublish = async () => {
    setError(null);setNotice(null);setSourceReady(false);publishId.current = crypto.randomUUID();publishDialog.current?.showModal()
    try {
      const [library, control] = await Promise.all([window.electronAPI.listPluginPresets(),window.electronAPI.getPluginControl()])
      if (!mounted.current) return
      if (!library.success || !control.success) {setError('community.errorSource');return}
      setSources(library.profiles);publishRevision.current = control.snapshot.state.revision;setSourceReady(true)
    } catch {if (mounted.current) setError('community.errorSource')}
  }
  const publish = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();if (!sourceReady) return
    const form = event.currentTarget, fields = new FormData(form)
    const name = String(fields.get('name') ?? '').trim(), headphones = String(fields.get('headphones') ?? '').trim()
    if (!name || !headphones) {setError('community.errorInvalid');return}
    void action(() => window.electronAPI.communityPublish({name,headphones,game:String(fields.get('game')),focus:fields.get('focus') as CommunityFocus,source:String(fields.get('source')),revision:publishRevision.current,requestId:publishId.current}), () => {
      publishDialog.current?.close();form.reset();setTab('mine');setPage(0);setSearch('');setGame('');setReload(v => v + 1);setNotice('community.published')
    })
  }
  const report = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();if (!selected) return
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim()
    void action(() => window.electronAPI.communityReport(selected.id,reason), () => {setReporting(false);setNotice('community.reported')})
  }
  const messages = <>{error && <p className="astral-community-error" role="alert">{t(error)}</p>}{notice && <p className="astral-community-notice" role="status">{t(notice)}</p>}</>

  return <section className="astral-community" aria-label={t('community.title')}>
    <div className="astral-community-header">
      <div className="astral-community-tabs" aria-label={t('community.title')}>{(['explore','saved','mine'] as const).map(value => <button type="button" key={value} disabled={busy} aria-pressed={tab === value} onClick={() => {setTab(value);setPage(0);setNotice(null)}}>{t(`community.${value}`)}</button>)}</div>
      <AstralButton icon={<FiPlus/>} disabled={busy} onClick={() => void openPublish()}>{t('community.publish')}</AstralButton>
    </div>
    <div className="astral-community-toolbar"><label className="astral-community-search"><FiSearch aria-hidden="true"/><input disabled={busy} maxLength={100} aria-label={t('community.search')} placeholder={t('community.search')} value={search} onChange={e => {setSearch(e.target.value);setPage(0)}}/></label><select disabled={busy} aria-label={t('community.game')} value={game} onChange={e => {setGame(e.target.value);setPage(0)}}><option value="">{t('community.allGames')}</option>{communityGames.map(value => <option key={value}>{value}</option>)}</select><AstralButton size="sm" variant="ghost" disabled={busy || loading} onClick={() => setReload(v => v + 1)}>{t('community.refresh')}</AstralButton></div>
    {messages}
    {canUndo && <AstralButton size="sm" variant="secondary" disabled={busy} onClick={() => void undo()}>{t('community.undo')}</AstralButton>}
    {loading ? <p role="status" className="astral-community-session">{t('community.loading')}</p> : profiles.length ? <div className="astral-community-grid">{profiles.map(profile => <article className="astral-community-card" key={profile.id}>
      <div className="astral-community-card-top"><span className="astral-community-engine"><LuWaves aria-hidden="true"/>Cosmic</span><span className="astral-community-applications" title={t('community.applications',{count:profile.applications ?? 0})} aria-label={t('community.applications',{count:profile.applications ?? 0})}><FiDownload aria-hidden="true"/>{profile.applications ?? 0}</span></div>
      <div className="astral-community-tags"><span>{profile.game}</span><span>{t(`community.${profile.focus}`)}</span></div>
      <h2>{profile.name}</h2><p className="astral-community-author">{t('community.by',{author:profile.author})}</p>
      <p className="astral-community-headphones"><FiHeadphones aria-hidden="true"/>{profile.headphones}</p>
      <div className="astral-community-card-footer"><button type="button" disabled={busy} onClick={() => openDetails(profile)}>{t('community.details')}<FiArrowUpRight aria-hidden="true"/></button><button type="button" disabled={busy} onClick={() => void apply(profile)}>{t('community.apply')}</button><button type="button" disabled={busy} className="astral-community-bookmark" aria-pressed={profile.saved} aria-label={t(profile.saved?'community.unsave':'community.save')} title={t(profile.saved?'community.unsave':'community.save')} onClick={() => void favorite(profile)}><FiBookmark aria-hidden="true"/></button></div>
    </article>)}</div> : !error ? <div className="astral-community-empty"><FiUsers aria-hidden="true"/><h2>{t('community.empty')}</h2><p>{t(tab==='mine'?'community.emptyMine':'community.emptyHelp')}</p>{search || game ? <AstralButton variant="secondary" onClick={() => {setSearch('');setGame('');setPage(0)}}>{t('community.reset')}</AstralButton> : null}</div> : <AstralButton disabled={busy} variant="secondary" onClick={() => setReload(v => v + 1)}>{t('community.refresh')}</AstralButton>}
    <div className="astral-community-pagination"><AstralButton size="sm" variant="ghost" disabled={busy || loading || page===0} onClick={() => setPage(v => v-1)}>{t('community.previous')}</AstralButton><span>{t('community.page',{page:page+1})}</span><AstralButton size="sm" variant="ghost" disabled={busy || loading || !more} onClick={() => setPage(v => v+1)}>{t('community.next')}</AstralButton></div>
    {busy && <p role="status" className="astral-community-session">{t('community.working')}</p>}
    <dialog ref={detailDialog} className="astral-community-dialog" aria-labelledby="community-detail-title">
      <button type="button" className="astral-community-close" aria-label={t('community.close')} onClick={() => detailDialog.current?.close()}><FiX/></button>
      {selected && <><span className="astral-community-engine"><LuWaves/>Cosmic · v{selected.version}</span><h2 id="community-detail-title">{selected.name}</h2><p>{t('community.by',{author:selected.author})}</p><dl><div><dt>{t('community.game')}</dt><dd>{selected.game}</dd></div><div><dt>{t('community.headphones')}</dt><dd>{selected.headphones}</dd></div><div><dt>{t('community.approach')}</dt><dd>{t(`community.${selected.focus}`)}</dd></div></dl>{messages}<div className="astral-community-form-actions"><AstralButton variant="secondary" disabled={busy} icon={<FiBookmark/>} onClick={() => void favorite(selected)}>{t(selected.saved?'community.unsave':'community.save')}</AstralButton><AstralButton disabled={busy} onClick={() => void apply(selected)}>{t('community.apply')}</AstralButton></div><p className="astral-community-dialog-note">{t('community.applyHelp')}</p><div className="astral-community-form-actions">{canUndo && <AstralButton variant="ghost" disabled={busy} onClick={() => void undo()}>{t('community.undo')}</AstralButton>}<AstralButton variant="ghost" disabled={busy} onClick={() => setReporting(v=>!v)}>{t('community.report')}</AstralButton>{selected.owned && <AstralButton variant="ghost" disabled={busy} onClick={() => setRemoveConfirm(true)}>{t('community.remove')}</AstralButton>}</div>
      {removeConfirm && <div className="astral-community-dialog-note"><p>{t('community.removeHelp')}</p><AstralButton variant="danger" disabled={busy} onClick={() => void action(()=>window.electronAPI.communityRemove(selected.id),()=>{detailDialog.current?.close();setReload(v=>v+1);setNotice('community.removed')})}>{t('community.confirmRemove')}</AstralButton><AstralButton variant="ghost" onClick={()=>setRemoveConfirm(false)}>{t('community.cancel')}</AstralButton></div>}
      {reporting && <form onSubmit={report}><label>{t('community.reportReason')}<textarea name="reason" required maxLength={600} rows={3}/></label><AstralButton type="submit" disabled={busy}>{t('community.sendReport')}</AstralButton></form>}</>}
    </dialog>
    <dialog ref={publishDialog} className="astral-community-dialog" aria-labelledby="community-publish-title" onCancel={event=>{if(busy)event.preventDefault()}}>
      <button type="button" disabled={busy} className="astral-community-close" aria-label={t('community.close')} onClick={() => publishDialog.current?.close()}><FiX/></button>
      <h2 id="community-publish-title">{t('community.publishTitle')}</h2><p>{t('community.publishLiveHelp')}</p>{messages}
      <form onSubmit={publish} onChange={()=>{publishId.current=crypto.randomUUID()}}><fieldset disabled={busy || !sourceReady}>
        <label>{t('community.source')}<select name="source"><option value="current">{t('community.currentSettings')}</option>{sources.map(source=><option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
        <label>{t('community.name')}<input name="name" required maxLength={60} placeholder={t('community.namePlaceholder')}/></label>
        <div className="astral-community-form-row"><label>{t('community.game')}<select name="game">{communityGames.map(value=><option key={value}>{value}</option>)}</select></label><label>{t('community.approach')}<select name="focus">{communityFocuses.map(value=><option key={value} value={value}>{t(`community.${value}`)}</option>)}</select></label></div>
        <label>{t('community.headphones')}<input name="headphones" required maxLength={80} placeholder={t('community.headphonesPlaceholder')}/></label>
      </fieldset><div className="astral-community-form-actions"><AstralButton variant="secondary" disabled={busy} onClick={()=>publishDialog.current?.close()}>{t('community.cancel')}</AstralButton><AstralButton type="submit" disabled={busy || !sourceReady}>{t(busy?'community.working':'community.publishNow')}</AstralButton></div></form>
    </dialog>
  </section>
}
