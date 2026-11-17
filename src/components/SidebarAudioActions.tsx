import { useEffect, useState } from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'
import { FiExternalLink, FiRefreshCw } from 'react-icons/fi'
import { useI18n } from '../i18n'

import type {VmState} from '../../shared/voicemeeter'
import AstralSelect from './ui/AstralSelect'
import {vmDrivers} from '../../shared/voicemeeter'
type Action = 'restart' | 'eapo'

export default function SidebarAudioActions() {
  const { t } = useI18n()
  const [busy, setBusy] = useState<Action | null>(null)
  const [failed, setFailed] = useState(false)
  const [audio,setAudio]=useState<VmState|null>(null),[deviceBusy,setDeviceBusy]=useState(false)
  useEffect(()=>{let live=true;const poll=()=>window.electronAPI.voicemeeterStatus().then(s=>{if(live)setAudio(s)}).catch(()=>{});void poll();const timer=setInterval(()=>void poll(),2000);return()=>{live=false;clearInterval(timer)}},[])
  const control=async(target:'input'|'output',key:string)=>{if(deviceBusy)return;setDeviceBusy(true);setFailed(false);try{setAudio(await window.electronAPI.voicemeeterCommand({action:'device',target,key}))}catch{setFailed(true)}finally{setDeviceBusy(false)}}

  const run = async (action: Action) => {
    if (busy) return
    setBusy(action)
    setFailed(false)
    const success = action === 'restart'
      ? await window.electronAPI.restartWindowsAudio()
      : await window.electronAPI.openEapoDeviceSelector()
    setFailed(!success)
    setBusy(null)
  }

  const buttonProps = {
    h: '32px', px: '2.5', align: 'center', gap: '2', borderRadius: '7px',
    color: 'whiteAlpha.700', bg: 'rgba(255,255,255,.025)', transition: '150ms',
  } as const

  return <Box><Box p="2" mb="2" borderRadius="10px" bg="#100d13" border="1px solid rgba(255,255,255,.065)"><Flex direction="column" gap="1.5">{(['input','output'] as const).map(target=>{
    const channel=target==='input'?audio?.strips[0]:audio?.bus
    const devices=(target==='input'?audio?.inputs??[]:audio?.outputs??[]).filter(d=>target==='input'||!/VB-Audio|Voicemeeter|CABLE/i.test(d.name))
    return <AstralSelect key={target} compact ariaLabel={t(target==='input'?'vm.quickMain':'vm.quickHeadphones')} value="" placeholder={channel?.name||t(target==='input'?'vm.quickMain':'vm.quickHeadphones')} options={devices.map(d=>({value:d.key,label:vmDrivers[d.type]?.toUpperCase()+": "+d.name}))} disabled={deviceBusy||!audio?.connected} onChange={key=>void control(target,key)}/>
  })}</Flex></Box><Box p="2" borderRadius="10px" bg="#100d13" border="1px solid rgba(255,255,255,.065)">
    <Flex direction="column" gap="1.5">
      <Flex as="button" {...buttonProps} cursor={busy ? 'not-allowed' : 'pointer'} opacity={busy && busy !== 'restart' ? .45 : 1} onClick={() => run('restart')} _hover={busy ? {} : { bg: 'rgba(155,77,255,.1)', color: 'white' }}><FiRefreshCw size="13" /><Text fontSize="10px" fontWeight="700">{t(busy === 'restart' ? 'audio.restarting' : 'audio.restart')}</Text></Flex>
      <Flex as="button" {...buttonProps} cursor={busy ? 'not-allowed' : 'pointer'} opacity={busy && busy !== 'eapo' ? .45 : 1} onClick={() => run('eapo')} _hover={busy ? {} : { bg: 'rgba(155,77,255,.1)', color: 'white' }}><FiExternalLink size="13" /><Text fontSize="10px" fontWeight="700">{t(busy === 'eapo' ? 'audio.opening' : 'audio.eapoSelector')}</Text></Flex>
    </Flex>
    {failed ? <Text mt="1.5" color="red.300" fontSize="9px">{t('audio.actionFailed')}</Text> : null}
  </Box></Box>
}
