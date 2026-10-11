import { Box, Flex, Text } from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { FiCheckCircle, FiLayers } from 'react-icons/fi'
import AstralSelect from './ui/AstralSelect'
import { useI18n } from '../i18n'

const MotionBox = motion.create(Box)
const subOptions = ['v2.1', 'v2.2', 'v2.3', 'v2.4', 'v2.5'].map(key => ({ key, label: `AT V${key.slice(1)}` }))
interface Props { subs: Record<string, boolean>; onSelect: (subKey: string) => void; disabled?: boolean }

export default function V2SubOptions({ subs, onSelect, disabled }: Props) {
  const { t } = useI18n()
  const selectedKey = Object.entries(subs).find(([, enabled]) => enabled)?.[0] ?? null
  return <MotionBox initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: .2 }}>
    <Box p="4" borderRadius="14px" bg="rgba(255,255,255,.022)" border="1px solid rgba(255,255,255,.075)">
      <Flex align="center" gap="3"><Flex w="40px" h="40px" flexShrink="0" align="center" justify="center" borderRadius="11px" bg="rgba(155,77,255,.13)" color="purple.300"><FiLayers size="18" /></Flex><Box flex="1" minW="0"><Text color="white" fontSize="sm" fontWeight="800">{t('profiles.v2Version')}</Text><Text color="whiteAlpha.400" fontSize="11px">{t('profiles.v2Description')}</Text></Box>{selectedKey ? <Flex align="center" gap="1.5" color="green.300"><FiCheckCircle size="13" /><Text fontSize="11px" fontWeight="700">{t('common.active')}</Text></Flex> : null}</Flex>
      <Box mt="4"><Text mb="1.5" color="whiteAlpha.450" fontSize="11px" fontWeight="650">{t('profiles.subconfiguration')}</Text><AstralSelect ariaLabel={t('profiles.v2Version')} value={selectedKey ?? ''} placeholder={t('profiles.selectVersion')} options={subOptions.map(option => ({ value: option.key, label: option.label, description: t('profiles.profile71') }))} onChange={onSelect} disabled={disabled} /></Box>
      <Flex mt="3" px="3" py="2.5" align="center" justify="space-between" borderRadius="9px" bg="rgba(155,77,255,.055)" border="1px solid rgba(155,77,255,.1)"><Text color="whiteAlpha.450" fontSize="11px">{t('profiles.configurationApplied')}</Text><Text color={selectedKey ? 'purple.200' : 'whiteAlpha.350'} fontSize="11px" fontWeight="750">{subOptions.find(option => option.key === selectedKey)?.label ?? t('profiles.noneApplied')}</Text></Flex>
    </Box>
  </MotionBox>
}
