import {pluginFingerprint,type PluginSnapshot} from '../../shared/plugin-control'
export function cosmicAudioStatus(snapshot:PluginSnapshot){
 const {state,instances}=snapshot
 const recent=instances.filter(i=>Date.now()>=i.updatedAt&&Date.now()-i.updatedAt<1500)
 const windowsAudio=recent.filter(i=>i.audioService&&i.evidence&&i.evidence.state!==0)
 const candidates=windowsAudio.length?windowsAudio:recent.filter(i=>i.evidence&&i.evidence.state!==0)
 const observed=candidates[0],audio=recent.filter(i=>i.processing)
 const enabled=[31,36,43].map(i=>state.values[i]>=.5)
 const moduleMissing=observed?enabled.some((on,i)=>on&&observed.modules[i]!==1):false
 const synced=!!observed&&observed.evidence?.state===1&&observed.evidence.hash===pluginFingerprint(state.values)&&observed.audioRevision>=state.revision
 const statusKey=moduleMissing?'plugin.modulesMissing':observed?.evidence?.state===2?'plugin.bypass':synced?'plugin.synced':candidates.length?'plugin.pending':audio.length?'plugin.needEvidence':instances.length?'plugin.editorOnly':'plugin.offline'

 return {observed,enabled,moduleMissing,synced,statusKey}
}
