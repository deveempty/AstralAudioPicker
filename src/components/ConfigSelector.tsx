import { Box, Flex, Icon, Text } from '@chakra-ui/react'
import { FiCheck, FiHeadphones, FiMusic, FiVolumeX } from 'react-icons/fi'
import { HiMusicalNote } from 'react-icons/hi2'
import { LuWaves } from 'react-icons/lu'
import type { IconType } from 'react-icons'
import { useI18n } from '../i18n'

type Selection = 'none' | 'v1' | 'v2' | 'aiwv2' | 'aiwv5' | 'custom'
interface Option { id: Selection; label: string; detail: string; icon: IconType }
const options: Option[] = [
  { id: 'none', label: '', detail: '', icon: FiVolumeX },
  { id: 'v1', label: 'AT V1', detail: '7.1', icon: FiMusic },
  { id: 'v2', label: 'AT V2', detail: '7.1', icon: HiMusicalNote },
  { id: 'aiwv2', label: 'AIW V3', detail: '7.1', icon: FiHeadphones },
  { id: 'aiwv5', label: 'AIW V5', detail: '16ch', icon: LuWaves },
  { id: 'custom', label: 'Cosmic', detail: '16ch', icon: LuWaves },
]

interface Props { currentSelection: Selection; onSelect: (value: Selection) => void; disabled?: boolean; statusMessage?: string | null }

export default function ConfigSelector({ currentSelection, onSelect, disabled, statusMessage }: Props) {
  const { t } = useI18n()
  return <Box className="audio-output-selector">
    <Flex mb="3" align="end" justify="space-between"><Box><Text color="white" fontSize="sm" fontWeight="750">{t('profiles.outputTitle')}</Text><Text color="whiteAlpha.400" fontSize="xs">{t('profiles.outputSubtitle')}</Text></Box>{statusMessage ? <Text color={statusMessage === t('common.failed') ? 'red.300' : 'green.300'} fontSize="xs">{statusMessage}</Text> : null}</Flex>
    <Flex className="audio-output-grid" gap="2.5" flexWrap="wrap">{options.map(option => {
      const active = option.id === currentSelection
      return <Box className="audio-output-option" aria-pressed={active} aria-disabled={disabled} key={option.id} as="button" position="relative" flex="1" minW="110px" minH="104px" px="4" py="4" textAlign="left" borderRadius="10px" bg={active ? 'rgba(155,77,255,.115)' : '#101012'} border="1px solid" borderColor={active ? '#9b4dff' : 'rgba(255,255,255,.075)'} color={active ? 'white' : 'whiteAlpha.650'} cursor={disabled ? 'not-allowed' : 'pointer'} opacity={disabled ? .55 : 1} transition="160ms ease" _hover={disabled ? {} : { bg: active ? 'rgba(155,77,255,.15)' : '#17121c', borderColor: active ? '#ad6aff' : 'rgba(255,255,255,.14)' }} onClick={() => !disabled && onSelect(option.id)}>
        {active ? <Flex position="absolute" right="8px" top="8px" w="18px" h="18px" borderRadius="full" align="center" justify="center" bg="#9b4dff"><FiCheck size="11" /></Flex> : null}
        <Icon as={option.icon} boxSize="5" color={active ? '#ad6aff' : 'whiteAlpha.400'} />
        <Text mt="2" fontSize="sm" fontWeight="700" truncate>{option.id === 'none' ? t('common.none') : option.label}</Text><Text color={active ? 'purple.300' : 'whiteAlpha.350'} fontSize="10px">{option.id === 'none' ? t('common.off') : option.detail}</Text>
      </Box>
    })}</Flex>
  </Box>
}
