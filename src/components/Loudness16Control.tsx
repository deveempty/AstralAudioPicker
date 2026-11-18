import {useLoudness16} from './Loudness16Provider'
import {Box,Flex,Text,Slider} from '@chakra-ui/react'
import {useI18n} from '../i18n'

export default function Loudness16Control({disabled=false}:{disabled?:boolean}){
 const {t}=useI18n()
 const {state,value,setValue,busy,applying,error,refresh,commit}=useLoudness16()
 return <Box className="cosmic-control" p="5" bg="#100d13" borderRadius="10px" border="1px solid rgba(255,255,255,.07)">
  <Flex as="label" align="center" justify="space-between" gap="4"><Text fontSize="sm" fontWeight="650">Loudness EQ</Text>{state?<input type="checkbox" aria-label="Loudness EQ" checked={state.enabled} disabled={disabled||busy} style={{accentColor:'#a78bfa',width:16,height:16}} onChange={e=>void commit({enabled:e.target.checked})}/>:<Text fontSize="xs" color="whiteAlpha.600">{t('audio.loudness16Unknown')}</Text>}</Flex>
  <Text mt="2" fontSize="xs" lineHeight="1.6" color="whiteAlpha.800">{t('audio.loudness16Help')}</Text>
  <Flex mt="3" justify="space-between"><Text fontSize="xs">{t('audio.releaseTime')}</Text><Text fontSize="xs" color="purple.200">{state?`${value/20+1}/6`:'—'}</Text></Flex>
  <Slider.Root mt="3" min={0} max={100} step={20} value={[value]} disabled={disabled||busy||!state||!state.enabled} onValueChange={e=>setValue(e.value[0])} onValueChangeEnd={e=>{if(e.value[0]!==state?.releaseTime)void commit({releaseTime:e.value[0]})}}>
   <Slider.Control><Slider.Track h="1.5" bg="whiteAlpha.200" borderRadius="full"><Slider.Range bg="purple.500"/></Slider.Track><Slider.Thumb index={0} boxSize="4" bg="purple.300" borderColor="purple.500" aria-label={t('audio.releaseTime')}><Slider.HiddenInput/></Slider.Thumb></Slider.Control>
  </Slider.Root>
  <Flex mt="2" justify="space-between" fontSize="xs" color="whiteAlpha.500"><Text>{t('audio.short')}</Text><Text>{t('audio.long')}</Text></Flex>
  {busy?<Text mt="2" role="status" fontSize="xs" color="purple.200">{t(applying?'audio.loudness16Applying':'audio.loudness16Reading')}</Text>:null}
  {error?<Text mt="2" role="alert" fontSize="xs" color="red.300">{t(error as 'audio.loudness16Error')}</Text>:null}
  {error?<button type="button" disabled={busy} onClick={()=>void refresh()}>{t('upgrade.retry')}</button>:null}
 </Box>
}
