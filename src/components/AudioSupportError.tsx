import {useState} from 'react'
import {Box,Flex,Text} from '@chakra-ui/react'
import {audioError,audioErrors} from '../../shared/audio-errors'
import {useI18n} from '../i18n'
import AstralButton from './ui/AstralButton'
export default function AudioSupportError({code,stage}:{code?:string;stage?:string}){
 const {t}=useI18n(),[copied,setCopied]=useState(false),[copyFailed,setCopyFailed]=useState(false)
 const message=audioError(code)
 return <Box role="alert" mt="3" border="1px solid #543135" borderRadius="9px" p="3" bg="#1a1115">
  <Text fontSize="sm" color="#f4b9c2">{t(`audioError.${code&&code in audioErrors?code as keyof typeof audioErrors:'UNKNOWN'}`)}</Text>
  <Text mt="1" fontSize="xs" color="#aaa4b5">{t('support.code')}: {message.code}</Text>
  <Text mt="2" fontSize="xs" color="#aaa4b5">{t('support.help')}</Text>
  <Flex mt="3" gap="2" wrap="wrap">
   <AstralButton size="sm" variant="secondary" onClick={()=>void navigator.clipboard.writeText(JSON.stringify({product:'Astral Audio',code:message.code,reason:code,stage,at:new Date().toISOString()})).then(()=>{setCopied(true);setCopyFailed(false)}).catch(()=>setCopyFailed(true))}>{t(copied?'support.copied':'support.copy')}</AstralButton>
   <AstralButton size="sm" variant="ghost" onClick={()=>void window.electronAPI.openAudioSupport()}>{t('support.discord')}</AstralButton>
  </Flex>
  {copyFailed?<Text mt="2" fontSize="xs">{t('support.copyFailed')}</Text>:null}
 </Box>
}
