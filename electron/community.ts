import {applyCommunityLoudness,readCommunityLoudness,sameLoudness,type CommunityLoudness} from './community-loudness'
import type {LoudnessEqSettings} from '../shared/loudness16'
import { createHash, randomUUID } from 'node:crypto'
import { communityPayload, validCommunityId, validCommunityMetadata, validCommunityPayload, validCommunityProfile, type CommunityApplied, type CommunityProfile, type CommunityPublication, type CommunityQuery, type CommunityResult } from '../shared/community'
import { pluginFingerprint, type PluginResult } from '../shared/plugin-control'
import type { PluginControlStore } from './plugin-control'

export function createCommunity(options: {
  request: (route: string, init?: RequestInit) => Promise<Response>
  loudness?:CommunityLoudness
  store: PluginControlStore
  isCosmicActive: () => boolean
  activateCosmic: () => Promise<() => Promise<void>>
}) {
  let undoLoudness:{revision:number;before:LoudnessEqSettings;after:LoudnessEqSettings}|undefined
  let pending = 0
  let tail: Promise<void> = Promise.resolve()
  const run = async <T>(work: () => Promise<T>): Promise<CommunityResult<T>> => {
    if (pending >= 32) return { success: false, code: 'busy' }
    pending++
    const previous = tail
    let release!: () => void
    tail = new Promise<void>(resolve => { release = resolve })
    await previous
    try { return { success: true, data: await work() } }
    catch (e) { return { success: false, code: e instanceof Error && /^[a-zA-Z_][a-zA-Z_0-9]{1,63}$/.test(e.message) ? e.message : 'COMMUNITY_UNAVAILABLE' } }
    finally { pending--; release() }
  }
  const request = async (route: string, init?: RequestInit) => {
    const response = await options.request(route, init)
    if (!response.ok || !response.body) throw Error('COMMUNITY_UNAVAILABLE')
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0
    try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 131072) throw Error('INVALID_PROFILE'); chunks.push(value) } }
    finally { await reader.cancel() }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  }
  const idPath = (id: unknown) => { if (!validCommunityId(id)) throw Error('INVALID'); return '/community/profiles/' + id }
  const confirmed = async (result: PluginResult): Promise<CommunityApplied> => {
    if (!result.success) throw Error(result.code)
    const revision = result.snapshot.state.revision, fingerprint = pluginFingerprint(result.snapshot.state.values)
    for (let i = 0; i < 12; i++) {
      const latest = options.store.get()
      if (latest.success && latest.snapshot.state.revision === revision && options.isCosmicActive() && latest.snapshot.instances.some(instance => instance.audioService && instance.processing && Date.now() - instance.updatedAt < 1500 && instance.audioRevision >= revision && instance.evidence?.state === 1 && instance.evidence.hash === fingerprint)) return { revision, engineConfirmed: true }
      await new Promise(resolve => setTimeout(resolve, 250))
    }
    return { revision, engineConfirmed: false }
  }
  return {
    list: (query: CommunityQuery) => run(async () => {
      if (!query || !['explore','saved','mine'].includes(query.tab) || typeof query.search !== 'string' || query.search.length > 100 || typeof query.game !== 'string' || query.game.length > 50 || !Number.isSafeInteger(query.page) || query.page < 0 || query.page > 1000) throw Error('INVALID')
      const params = new URLSearchParams({ tab:query.tab, search:query.search, game:query.game, page:String(query.page) })
      const data = await request('/community/profiles?' + params)
      if (!Array.isArray(data.profiles) || data.profiles.length > 24 || !data.profiles.every(validCommunityProfile) || typeof data.more !== 'boolean') throw Error('INVALID_PROFILE')
      return data as { profiles: CommunityProfile[]; more: boolean }
    }),
    publish: (publication: CommunityPublication) => run(async () => {
      if (!validCommunityMetadata(publication) || !validCommunityId(publication.requestId) || typeof publication.source !== 'string') throw Error('INVALID')
      let values: number[]
      let loudnessEq:LoudnessEqSettings|undefined
      if (publication.source === 'current') {
        const state = options.store.get(); if (!state.success) throw Error(state.code)
        if (state.snapshot.state.revision !== publication.revision) throw Error('stale')
        values = state.snapshot.state.values
        loudnessEq = await readCommunityLoudness(options.loudness)
      } else { const preset=options.store.library.read(publication.source); values=preset.values; loudnessEq=preset.loudnessEq }
      if(loudnessEq) {
        const capabilities=await request('/community/profiles?tab=mine&page=0')
        if(!Array.isArray(capabilities.features)||!capabilities.features.includes('loudness-eq-v1'))throw Error('COMMUNITY_LOUDNESS_SERVICE_REQUIRED')
      }
      const { name, game, headphones, focus, notes, requestId } = publication
      const data = await request('/community/profiles', { method:'POST', body:JSON.stringify({name,game,headphones,focus,notes,requestId,payload:communityPayload(values,loudnessEq)}) })
      if (!validCommunityId(data.id)) throw Error('INVALID_PROFILE')
      return { id:data.id as string }
    }),
    apply: (id: string) => run(async () => {
      const route = idPath(id)
      const previous = options.store.get(); if (!previous.success) throw Error(previous.code)
      const data = await request(route)
      if (data.id !== id || data.version !== 1 || !validCommunityPayload(data.payload)) throw Error('INVALID_PROFILE')
      const payload = JSON.stringify(communityPayload(data.payload.values,data.payload.loudnessEq))
      if (createHash('sha256').update(payload).digest('hex') !== data.sha256) throw Error('INVALID_PROFILE')
      const rollback = await options.activateCosmic()
      if (!options.isCosmicActive()) {await rollback();throw Error('COSMIC_NOT_ACTIVE')}
      let loudnessChange:Awaited<ReturnType<typeof applyCommunityLoudness>>|undefined
      let result:PluginResult
      try {
        if(data.payload.loudnessEq)loudnessChange=await applyCommunityLoudness(options.loudness,data.payload.loudnessEq)
        result=options.store.applyCommunity(data.payload.values,previous.snapshot.state.revision)
        if(!result.success)throw Error(result.code)
      } catch(error) {
        try {await loudnessChange?.restore()} finally {await rollback()}
        throw error
      }
      undoLoudness=loudnessChange&&result.success?{revision:result.snapshot.state.revision,before:loudnessChange.before,after:data.payload.loudnessEq}:undefined
      const applied = await confirmed(result)
      // Analytics must never turn a successful settings write into an application error.
      try {
        const receipt = await request(route + '/applied', { method:'POST', body:JSON.stringify({requestId:randomUUID()}) })
        if (Number.isSafeInteger(receipt.applications) && receipt.applications >= 0) applied.applications = receipt.applications
      } catch { /* A missing receipt leaves the existing counter unchanged. */ }
      return applied
    }),
    undo: () => run(async () => {
      if (!options.isCosmicActive()) throw Error('COSMIC_NOT_ACTIVE')
      let change:Awaited<ReturnType<typeof applyCommunityLoudness>>|undefined
      if(undoLoudness) {
        const current=options.store.get()
        if(!current.success||current.snapshot.state.revision!==undoLoudness.revision||!sameLoudness(await readCommunityLoudness(options.loudness),undoLoudness.after))throw Error('stale')
        change=await applyCommunityLoudness(options.loudness,undoLoudness.before)
      }
      const result=options.store.undoCommunity()
      if(!result.success){await change?.restore();throw Error(result.code)}
      undoLoudness=undefined
      return confirmed(result)
    }),
    favorite: (id: string, saved: boolean) => run(async () => {
      if (typeof saved !== 'boolean') throw Error('INVALID')
      const data = await request(idPath(id) + '/favorite', { method:saved?'PUT':'DELETE' })
      if (data.saved !== saved) throw Error('INVALID_PROFILE')
      return {saved}
    }),
    report: (id: string, reason: string) => run(async () => {
      if (typeof reason !== 'string' || !reason.trim() || reason.length > 600) throw Error('INVALID')
      const data = await request(idPath(id) + '/report', { method:'POST', body:JSON.stringify({reason}) })
      if (data.reported !== true) throw Error('INVALID_PROFILE')
      return {reported:true}
    }),
    remove: (id: string) => run(async () => {
      const data = await request(idPath(id), { method:'DELETE' })
      if (data.removed !== true) throw Error('INVALID_PROFILE')
      return {removed:true}
    }),
  }
}
