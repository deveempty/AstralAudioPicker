import { useState } from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'
import { FiExternalLink, FiRefreshCw, FiVolumeX } from 'react-icons/fi'
import { useI18n } from '../i18n'

type Action = 'restart' | 'eapo' | 'voicemeeter'

export default function SidebarAudioActions() {
  const { t } = useI18n()
  const [busy, setBusy] = useState<Action | null>(null)
  const [failed, setFailed] = useState(false)

  const run = async (action: Action) => {
    if (busy) return
    setBusy(action)
    setFailed(false)
    const success = action === 'restart'
      ? await window.electronAPI.restartWindowsAudio()
      : action === 'eapo'
        ? await window.electronAPI.openEapoDeviceSelector()
        : await window.electronAPI.disableVoicemeeterEndpoints()
    setFailed(!success)
    setBusy(null)
  }

  const buttonProps = {
    h: '32px', px: '2.5', align: 'center', gap: '2', borderRadius: '7px',
    color: 'whiteAlpha.700', bg: 'rgba(255,255,255,.025)', transition: '150ms',
  } as const

  return <Box p="2" borderRadius="10px" bg="#100d13" border="1px solid rgba(255,255,255,.065)">
    <Flex direction="column" gap="1.5">
      <Flex as="button" {...buttonProps} cursor={busy ? 'not-allowed' : 'pointer'} opacity={busy && busy !== 'restart' ? .45 : 1} onClick={() => run('restart')} _hover={busy ? {} : { bg: 'rgba(155,77,255,.1)', color: 'white' }}><FiRefreshCw size="13" /><Text fontSize="10px" fontWeight="700">{t(busy === 'restart' ? 'audio.restarting' : 'audio.restart')}</Text></Flex>
      <Flex as="button" {...buttonProps} cursor={busy ? 'not-allowed' : 'pointer'} opacity={busy && busy !== 'eapo' ? .45 : 1} onClick={() => run('eapo')} _hover={busy ? {} : { bg: 'rgba(155,77,255,.1)', color: 'white' }}><FiExternalLink size="13" /><Text fontSize="10px" fontWeight="700">{t(busy === 'eapo' ? 'audio.opening' : 'audio.eapoSelector')}</Text></Flex>
      <Flex as="button" {...buttonProps} cursor={busy ? 'not-allowed' : 'pointer'} opacity={busy && busy !== 'voicemeeter' ? .45 : 1} onClick={() => run('voicemeeter')} _hover={busy ? {} : { bg: 'rgba(155,77,255,.1)', color: 'white' }}><FiVolumeX size="13" /><Text fontSize="10px" fontWeight="700">{t(busy === 'voicemeeter' ? 'audio.disabling' : 'audio.disableVoicemeeter')}</Text></Flex>
    </Flex>
    {failed ? <Text mt="1.5" color="red.300" fontSize="9px">{t('audio.actionFailed')}</Text> : null}
  </Box>
}
