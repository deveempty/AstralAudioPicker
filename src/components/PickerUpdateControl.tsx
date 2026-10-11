import { useEffect, useState } from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'
import { FiCheckCircle, FiDownloadCloud, FiRefreshCw } from 'react-icons/fi'
import type { UpdateStatus } from '../types/electron'
import { useI18n, type TranslationKey } from '../i18n'

const labelKeys: Partial<Record<UpdateStatus['phase'], TranslationKey>> = {
  checking: 'update.checking', available: 'update.available', downloaded: 'update.downloaded',
  'up-to-date': 'update.current', migrating: 'update.migrating', development: 'update.installedOnly', error: 'update.error',
}

export default function PickerUpdateControl() {
  const { t } = useI18n()
  const [status, setStatus] = useState<UpdateStatus>({ phase: 'idle' })
  useEffect(() => { void window.electronAPI.getPickerUpdateStatus().then(setStatus); return window.electronAPI.onPickerUpdateStatus(setStatus) }, [])
  const checking = ['checking', 'available', 'downloading', 'migrating'].includes(status.phase)
  const downloaded = status.phase === 'downloaded'
  const label = status.phase === 'downloading' ? t('update.downloading', { progress: status.progress ?? 0 }) : t(labelKeys[status.phase] ?? 'update.check')
  const click = () => { if (downloaded) void window.electronAPI.installPickerUpdate(); else if (!checking) void window.electronAPI.checkPickerUpdates() }
  return <Box mt="2" p="2" borderRadius="10px" bg="#100d13" border="1px solid rgba(255,255,255,.065)">
    <Flex as="button" w="100%" h="32px" px="2.5" align="center" gap="2" borderRadius="7px" color={downloaded ? 'purple.200' : status.phase === 'error' ? 'red.300' : 'whiteAlpha.700'} bg={downloaded ? 'rgba(155,77,255,.12)' : 'rgba(255,255,255,.025)'} cursor={checking ? 'wait' : 'pointer'} onClick={click} _hover={checking ? {} : { bg: 'rgba(155,77,255,.1)', color: 'white' }} transition="150ms">
      {status.phase === 'up-to-date' ? <FiCheckCircle size="13" /> : downloaded ? <FiDownloadCloud size="13" /> : <FiRefreshCw size="13" />}<Text fontSize="10px" fontWeight="700">{downloaded ? t('update.installRestart') : label}</Text>
    </Flex>
    {status.message ? <Text mt="1.5" px="1" color={status.phase === 'error' ? 'red.300' : 'whiteAlpha.400'} fontSize="9px" lineClamp="2">{status.message}</Text> : null}
  </Box>
}
