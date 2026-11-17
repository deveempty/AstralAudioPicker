import {useCallback,useEffect,useRef,useState} from 'react'
import {Box,Flex,Text,Slider} from '@chakra-ui/react'
import {useI18n} from '../i18n'
import type {Loudness16Change,Loudness16State} from '../../shared/loudness16'

export default function Loudness16Control({disabled=false}:{disabled?:boolean}){
 const {t}=useI18n(),[state,setState]=useState<Loudness16State|null>(null),[value,setValue]=useState(40),[busy,setBusy]=useState(false),[error,setError]=useState('')
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
  if(pending.current||disabled||!state)return
  pending.current=true;setBusy(true);setError('')
  try{const next=await window.electronAPI.setLoudness16(change);if(alive.current){setState(next);setValue(next.releaseTime)}}
  catch(e){if(alive.current){const message=String(e);setError(message.includes('LOUDNESS_RELAY_RESTART_FAILED')?'audio.loudness16RelayError':message.includes('LOUDNESS_RESTART_FAILED')?'audio.loudness16RestartError':message.includes('LOUDNESS_ELEVATION_FAILED')?'audio.loudness16ElevationError':message.includes('LOUDNESS_WRITE_FAILED')?'audio.loudness16WriteError':'audio.loudness16Error')}try{const actual=await window.electronAPI.getLoudness16();if(alive.current){setState(actual);setValue(actual.releaseTime)}}catch{if(alive.current)setState(null)}}
  finally{pending.current=false;if(alive.current)setBusy(false)}
 }
 return <Box className="cosmic-control" p="5" bg="#100d13" borderRadius="10px" border="1px solid rgba(255,255,255,.07)">
  <Flex as="label" align="center" justify="space-between" gap="4"><Text fontSize="sm" fontWeight="650">Loudness EQ</Text>{state?<input type="checkbox" aria-label="Loudness EQ" checked={state.enabled} disabled={disabled||busy} style={{accentColor:'#a78bfa',width:16,height:16}} onChange={e=>void commit({enabled:e.target.checked})}/>:<Text fontSize="xs" color="whiteAlpha.600">{t('audio.loudness16Unknown')}</Text>}</Flex>
  <Text mt="2" fontSize="xs" lineHeight="1.6" color="whiteAlpha.800">{t('audio.loudness16Help')}</Text>
  <Flex mt="3" justify="space-between"><Text fontSize="xs">{t('audio.releaseTime')}</Text><Text fontSize="xs" color="purple.200">{state?`${value/20+1}/6`:'—'}</Text></Flex>
  <Slider.Root mt="3" min={0} max={100} step={20} value={[value]} disabled={disabled||busy||!state||!state.enabled} onValueChange={e=>setValue(e.value[0])} onValueChangeEnd={e=>{if(e.value[0]!==state?.releaseTime)void commit({releaseTime:e.value[0]})}}>
   <Slider.Control><Slider.Track h="1.5" bg="whiteAlpha.200" borderRadius="full"><Slider.Range bg="purple.500"/></Slider.Track><Slider.Thumb index={0} boxSize="4" bg="purple.300" borderColor="purple.500" aria-label={t('audio.releaseTime')}><Slider.HiddenInput/></Slider.Thumb></Slider.Control>
  </Slider.Root>
  <Flex mt="2" justify="space-between" fontSize="xs" color="whiteAlpha.500"><Text>{t('audio.short')}</Text><Text>{t('audio.long')}</Text></Flex>
  {busy?<Text mt="2" role="status" fontSize="xs" color="purple.200">{t('audio.loudness16Applying')}</Text>:null}
  {error?<Text mt="2" role="alert" fontSize="xs" color="red.300">{t(error as 'audio.loudness16Error')}</Text>:null}
  {error?<button type="button" disabled={busy} onClick={()=>void refresh()}>{t('upgrade.retry')}</button>:null}
 </Box>
}
