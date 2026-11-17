import {createContext,useContext,useCallback,useEffect,useRef,useState,type ReactNode} from 'react'
import type {Loudness16Change,Loudness16State} from '../../shared/loudness16'

interface LoudnessContextValue { state:Loudness16State|null; value:number; setValue:(value:number)=>void; busy:boolean; error:string; refresh:()=>Promise<void>; commit:(change:Loudness16Change)=>Promise<void> }
const LoudnessContext=createContext<LoudnessContextValue|null>(null)
export function Loudness16Provider({children}:{children:ReactNode}) {
 const [state,setState]=useState<Loudness16State|null>(null),[value,setValue]=useState(40),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const pending=useRef(false),alive=useRef(true)
 const refresh=useCallback(async()=>{
  if(pending.current)return
  pending.current=true;setBusy(true)
  try{const s=await window.electronAPI.getLoudness16();if(alive.current){setState(s);setValue(s.releaseTime);setError('')}}
  catch{if(alive.current){setState(null);setError('audio.loudness16Error')}}
  finally{pending.current=false;if(alive.current)setBusy(false)}
 },[])
 useEffect(()=>{
  alive.current=true;void refresh()
  const update=()=>void refresh()
  window.addEventListener('focus',update)
  const unsubscribe=window.electronAPI.onLoudness16Changed?.(update)
  return()=>{alive.current=false;window.removeEventListener('focus',update);unsubscribe?.()}
 },[refresh])
 const commit=async(change:Loudness16Change)=>{
  if(pending.current||!state)return
  pending.current=true;setBusy(true);setError('')
  try{const next=await window.electronAPI.setLoudness16(change);if(alive.current){setState(next);setValue(next.releaseTime)}}
  catch(e){if(alive.current){const message=String(e);setError(message.includes('LOUDNESS_RELAY_RESTART_FAILED')?'audio.loudness16RelayError':message.includes('LOUDNESS_RESTART_FAILED')?'audio.loudness16RestartError':message.includes('LOUDNESS_ELEVATION_FAILED')?'audio.loudness16ElevationError':message.includes('LOUDNESS_WRITE_FAILED')?'audio.loudness16WriteError':'audio.loudness16Error')}try{const actual=await window.electronAPI.getLoudness16();if(alive.current){setState(actual);setValue(actual.releaseTime)}}catch{if(alive.current)setState(null)}}
  finally{pending.current=false;if(alive.current)setBusy(false)}
 }

 return <LoudnessContext.Provider value={{state,value,setValue,busy,error,refresh,commit}}>{children}</LoudnessContext.Provider>
}
export function useLoudness16(){
 const context=useContext(LoudnessContext)
 if(!context)throw new Error('Loudness16Provider is required')
 return context
}
