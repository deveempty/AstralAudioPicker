import {useEffect,useState} from 'react'
import {Box,Flex,Text} from '@chakra-ui/react'
import {FiCheckCircle,FiCircle} from 'react-icons/fi'
import {useI18n} from '../i18n'

export default function RelayStatus(){
 const {t}=useI18n(),[connected,setConnected]=useState<boolean|null>(null)
 useEffect(()=>{
  let live=true,running=false
  const refresh=async()=>{if(running)return;running=true;try{const state=await window.electronAPI.voicemeeterStatus();if(live)setConnected(state.connected)}catch{if(live)setConnected(false)}finally{running=false}}
  void refresh();const timer=setInterval(()=>void refresh(),2000)
  return()=>{live=false;clearInterval(timer)}
 },[])
 return <Box mt="2" p="3" borderRadius="10px" bg="#100d13" border="1px solid rgba(255,255,255,.065)">
  <Flex role="status" align="center" gap="2" color={connected?'green.300':'whiteAlpha.600'}>
   {connected?<FiCheckCircle size="13"/>:<FiCircle size="13"/>}
   <Text fontSize="11px" fontWeight="700">{t(connected===null?'vm.relayChecking':connected?'vm.relayConnected':'vm.relayDisconnected')}</Text>
  </Flex>
 </Box>
}
