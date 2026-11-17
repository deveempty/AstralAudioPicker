import {useEffect,useRef,useState} from 'react'
import {Box,Flex,Text} from '@chakra-ui/react'
import {FiCheck,FiCircle,FiAlertCircle} from 'react-icons/fi'
import AudioSupportError from './AudioSupportError'
import {preparationSteps} from '../../shared/post-update'
import {useI18n,type TranslationKey} from '../i18n'
import AstralButton from './ui/AstralButton'
import {vmAutoKey} from './VoicemeeterControl'
import type {AudioUpgradeStatus} from '../../shared/audio-upgrade'
export default function AudioUpgradeNotice({openRouting}:{openRouting:()=>void}){
 const {t}=useI18n(),[state,setState]=useState<AudioUpgradeStatus>({phase:'development'}),[busy,setBusy]=useState(false)
 const ready=useRef(false),panel=useRef<HTMLDivElement>(null)
 useEffect(()=>{if(state.preparation?.phase==='running')panel.current?.focus()},[state.preparation?.phase])
 useEffect(()=>{
  let active=true,inFlight=false
  const poll=async()=>{if(inFlight)return;inFlight=true;try{
   const next=await window.electronAPI.audioUpgradeStatus()
   if(!active)return
   setState(next)
   if(next.phase==='ready'&&!ready.current){
    ready.current=true
    window.dispatchEvent(new Event('astral-config-changed'))
    if(localStorage.getItem(vmAutoKey)===null&&next.preparation?.completed.includes('relay'))localStorage.setItem(vmAutoKey,'true')
   }
  }catch{/* Retry after startup IPC becomes available. */}finally{inFlight=false}}
  void poll();const timer=setInterval(()=>void poll(),500)
  return()=>{active=false;clearInterval(timer)}
 },[])
 if(state.phase==='ready'||state.phase==='development')return null
 const act=async(install=false)=>{setBusy(true);try{setState(await (install?window.electronAPI.audioUpgradeInstall():window.electronAPI.audioUpgradeRetry()))}catch{setState({phase:'error'})}finally{setBusy(false)}}
 const preparation=state.preparation,running=preparation?.phase==='running'
 const operations=new Set(['downloading','content','relay-connect','relay-startup-inspect','relay-backup','relay-startup-transfer','relay-readback','apo-inspect','apo-repair','apo-readback'])
 if(preparation&&preparation.phase!=='idle')return <Box ref={panel} tabIndex={-1} outline="none" onKeyDown={event=>{if(running&&event.key==='Tab')event.preventDefault()}} position={running?'fixed':'relative'} inset={running?'0':undefined} zIndex={running?150:undefined} bg={running?'rgba(2,2,4,.94)':'#08090c'} display={running?'flex':'block'} alignItems="center" justifyContent="center" p="6" role={running?'dialog':undefined} aria-modal={running?true:undefined} aria-labelledby="audio-preparation-title">
  <Box w="100%" maxW={running?'560px':undefined} border="1px solid #30263f" borderRadius="14px" bg="#08090c" p="6">
   <Text fontSize="10px" color="#b6a0dc" letterSpacing=".12em">ASTRAL AUDIO</Text>
   <Text id="audio-preparation-title" fontSize="xl" fontWeight="700" mt="2">{t('preparation.title')}</Text>
   <Text mt="2" color="#92959f" fontSize="sm">{t('preparation.description')}</Text>
   <Box mt="5" role="progressbar" aria-label={t('preparation.progress')} aria-valuemin={0} aria-valuemax={7} aria-valuenow={preparation.completed.length} bg="#202127" h="3px" borderRadius="full"><Box h="100%" w={`${preparation.completed.length/7*100}%`} bg="linear-gradient(90deg,#8b5cf6,#5aa7ff)" borderRadius="full"/></Box>
   <Box as="ol" listStyleType="none" p="0" mt="4">
    {preparationSteps.map(step=>{const complete=preparation.completed.includes(step),active=preparation.step===step&&!complete,failed=active&&preparation.phase==='error';return <Flex as="li" key={step} align="center" gap="3" py="2.5" opacity={complete||active?1:.45}>
     <Flex w="26px" h="26px" flexShrink="0" align="center" justify="center" borderRadius="full" color={failed?'#f4b9c2':complete?'#8ddab1':'#b7a0ff'} bg={active?'#21162e':'transparent'}>{complete?<FiCheck/>:failed?<FiAlertCircle/>:<FiCircle/>}</Flex>
     <Box><Text fontSize="sm" fontWeight={active?'600':'400'}>{t(`preparation.${step}`)}</Text>{active?<Text role="status" aria-live="polite" fontSize="xs" color="#92959f" mt="1">{failed?t('preparation.attention'):(operations.has(state.operation??'')?t(`preparation.operation.${state.operation}` as TranslationKey):t('preparation.running'))}{!failed&&preparation.percent!==undefined?` ${Math.floor(preparation.percent)}%`:''}</Text>:null}</Box>
    </Flex>})}
   </Box>
   {preparation.phase==='error'?<><AudioSupportError code={state.code} stage={preparation.step}/><Flex mt="4" gap="2" wrap="wrap"><AstralButton disabled={busy} onClick={()=>void act()}>{t('upgrade.retry')}</AstralButton>{state.code?.startsWith('RELAY_')?<AstralButton variant="secondary" onClick={openRouting}>{t('upgrade.route')}</AstralButton>:null}{state.code==='RELAY_INSTALL_REQUIRED'?<AstralButton disabled={busy} onClick={()=>void act(true)}>{t('upgrade.install')}</AstralButton>:null}{state.code==='APO_CHAIN_UNCONFIRMED'?<AstralButton variant="secondary" onClick={()=>void window.electronAPI.openEapoDeviceSelector()}>{t('preparation.selector')}</AstralButton>:null}</Flex></>:null}
  </Box>
 </Box>
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
