import type {VmState} from '../shared/voicemeeter'
import type {DiagnosticCheck} from '../shared/diagnostics'

export function relayChecks(state:VmState):DiagnosticCheck[]{
 const checks:DiagnosticCheck[]=[]
 const add=(id:string,status:DiagnosticCheck['status'],detail:string,values?:Record<string,string|number>,paths?:string[])=>checks.push({id,status,detail,values,paths})
 if(state.error){add('relay','unknown','relayUnavailable');return checks}
 if(!state.installed){add('relay','warning','relayMissing');return checks}
 add('relay',state.connected?'ok':'warning',state.connected?'relayConnected':'relayStopped')
 if(!state.connected)return checks
 for(const [index,channel] of [...state.strips.slice(0,2),state.bus].entries()){
  const output=index===2,id=output?'relayOutput':index===0?'relayInput':'relayInput2'
  if(!channel.name){add(id,index===1?'info':'warning',index===1?'relayOptional':'relayUnselected');continue}
  const available=(output?state.outputs:state.inputs).some(d=>d.name===channel.name)
  add(id,!available||channel.mute?'warning':'ok',!available?'relayDeviceMissing':channel.mute?'relayMuted':'relaySelected',{gain:channel.gain},[channel.name])
 }
 const settings=state.settings??{}
 add('relaySettings','info','relaySettingsInfo',Object.fromEntries(['sr','mme','wdm','ks','asio'].map(k=>[k,settings[k as keyof typeof settings]??'—'])))
 add('relaySignal','info','relaySignalInfo',{input:state.strips[0]?.peakDb??'—',output:state.bus.peakDb})
 return checks
}
