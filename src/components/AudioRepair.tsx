import {useState} from 'react'
import {Box,Flex,Text} from '@chakra-ui/react'
import {useI18n} from '../i18n'
import AstralButton from './ui/AstralButton'
import AudioSupportError from './AudioSupportError'

export default function AudioRepair({onChecked}:{onChecked:()=>void}){
 const {t}=useI18n(),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[code,setCode]=useState<string>(),[launchFailed,setLaunchFailed]=useState(false),[success,setSuccess]=useState<boolean>()
 const launch=async()=>{setBusy(true);setLaunchFailed(false);setSuccess(undefined);try{setLaunchFailed(!await window.electronAPI.openEapoDeviceSelector())}catch{setLaunchFailed(true)}finally{setBusy(false)}}
 const verify=async()=>{setBusy(true);setCode(undefined);setSuccess(undefined);try{
  const result=await window.electronAPI.finishAudioRepair()
  if(result.ok){setSuccess(result.active);window.dispatchEvent(new Event('astral-config-changed'))}else setCode(result.code)
 }catch{setCode('PREPARATION_INTERRUPTED')}finally{setBusy(false);onChecked()}}
 return <Box>
  <AstralButton size="sm" variant="secondary" disabled={busy} aria-expanded={open} onClick={()=>setOpen(!open)}>{t('repair.action')}</AstralButton>
  {open?<Box mt="3" p="4" border="1px solid #30263f" borderRadius="10px" bg="#0c0b10">
   <Text fontWeight="600">{t('repair.title')}</Text>
   <Text mt="2" fontSize="sm" color="#b6b3c0">{t('repair.description')}</Text>
   <Box as="ol" pl="5" mt="3" fontSize="sm" color="#c5c6ce" listStyleType="decimal">
    <li>{t('repair.step1')}</li><li>{t('repair.step2')}</li><li>{t('repair.step3')}</li>
   </Box>
   <Flex mt="4" gap="2" wrap="wrap">
    <AstralButton size="sm" disabled={busy} onClick={()=>void verify()}>{t(busy?'repair.working':'repair.verify')}</AstralButton>
    {code?<AstralButton size="sm" variant="secondary" disabled={busy} onClick={()=>void launch()}>{t('preparation.selector')}</AstralButton>:null}
   </Flex>
   {launchFailed?<Text role="alert" mt="3" fontSize="sm" color="#f4b9c2">{t('repair.launchFailed')}</Text>:null}
   {code?<AudioSupportError code={code} stage="repair"/>:null}
   {success!==undefined?<Text role="status" mt="3" fontSize="sm" color="#6fdaad">{t(success?'repair.success':'repair.inactive')}</Text>:null}
  </Box>:null}
 </Box>
}
