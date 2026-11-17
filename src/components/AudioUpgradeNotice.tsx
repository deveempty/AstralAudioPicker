import {useEffect,useRef,useState} from 'react'
import {Box,Flex,Text} from '@chakra-ui/react'
import {useI18n} from '../i18n'
import AstralButton from './ui/AstralButton'
import {vmAutoKey} from './VoicemeeterControl'
import type {AudioUpgradeStatus} from '../../shared/audio-upgrade'
export default function AudioUpgradeNotice({openRouting}:{openRouting:()=>void}){
 const {t}=useI18n(),[state,setState]=useState<AudioUpgradeStatus>({phase:'development'}),[busy,setBusy]=useState(false)
 const ready=useRef(false)
 useEffect(()=>{
  let active=true,inFlight=false
  const poll=async()=>{if(inFlight)return;inFlight=true;try{
   const next=await window.electronAPI.audioUpgradeStatus()
   if(!active)return
   setState(next)
   if(next.phase==='ready'&&!ready.current){
    ready.current=true
    window.dispatchEvent(new Event('astral-config-changed'))
    if(localStorage.getItem(vmAutoKey)===null){localStorage.setItem(vmAutoKey,'true');void window.electronAPI.voicemeeterCommand({action:'connect'}).catch(()=>{})}
   }
  }catch{/* Retry after startup IPC becomes available. */}finally{inFlight=false}}
  void poll();const timer=setInterval(()=>void poll(),1500)
  return()=>{active=false;clearInterval(timer)}
 },[])
 if(state.phase==='ready'||state.phase==='development')return null
 const act=async(install=false)=>{setBusy(true);try{setState(await (install?window.electronAPI.audioUpgradeInstall():window.electronAPI.audioUpgradeRetry()))}catch{setState({phase:'error'})}finally{setBusy(false)}}
 return <Box borderBottom="1px solid #30263f" bg="#14101c" px="6" py="4" role="status">
  <Flex align="center" gap="4" justify="space-between" wrap="wrap">
   <Box><Text fontSize="sm" fontWeight="600">{t('upgrade.title')}</Text><Text mt="1" fontSize="xs" color="whiteAlpha.700">{t(`upgrade.${state.phase}`)}</Text></Box>
   <Flex gap="2">
    {state.phase==='needsInstall'?<AstralButton disabled={busy} onClick={()=>void act(true)}>{t('upgrade.install')}</AstralButton>:null}
    {state.phase==='needsRoute'?<AstralButton onClick={openRouting}>{t('upgrade.route')}</AstralButton>:null}
    {['error','conflict','needsRoute','needsRestart'].includes(state.phase)?<AstralButton disabled={busy} onClick={()=>void act()}>{t('upgrade.retry')}</AstralButton>:null}
   </Flex>
  </Flex>
 </Box>
}
