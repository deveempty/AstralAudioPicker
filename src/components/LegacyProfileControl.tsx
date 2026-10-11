import { Box, Flex, Text, VStack } from '@chakra-ui/react'
import { FiHeadphones } from 'react-icons/fi'
import ProfileEqCard from './ProfileEqCard'
import { useI18n, type TranslationKey } from '../i18n'

interface Props { profile: 'v1' | 'aiwv2'; disabled?: boolean }
const profileDetails: Record<Props['profile'], { title: string; description: TranslationKey }> = {
  v1: { title: 'AT V1', description: 'profiles.legacyAtDescription' },
  aiwv2: { title: 'AIW V3', description: 'profiles.legacyAiwDescription' },
}

export default function LegacyProfileControl({ profile, disabled = false }: Props) {
  const { t } = useI18n()
  const details = profileDetails[profile]
  return <VStack gap="4" align="stretch">
    <Flex p="4" align="center" gap="3" borderRadius="14px" bg="rgba(255,255,255,.025)" border="1px solid rgba(255,255,255,.075)">
      <Flex w="42px" h="42px" flexShrink="0" align="center" justify="center" borderRadius="11px" bg="rgba(155,77,255,.13)" color="purple.300"><FiHeadphones size="19" /></Flex>
      <Box minW="0"><Text color="white" fontSize="sm" fontWeight="800">{details.title} · 7.1</Text><Text color="whiteAlpha.450" fontSize="xs">{t(details.description)}</Text></Box>
    </Flex>
    <ProfileEqCard profile={profile === 'v1' ? 'atV1' : 'aiwV3'} disabled={disabled} showPreamp />
  </VStack>
}
