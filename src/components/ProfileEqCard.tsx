import { useEffect, useState } from 'react'
import { Box, Button, Flex, Text } from '@chakra-ui/react'
import { FiCheck, FiChevronRight, FiHeadphones, FiX } from 'react-icons/fi'
import AstralButton from './ui/AstralButton'
import StatusTag from './ui/StatusTag'
import type { AutoEqLibraryGroup, EqProfile } from '../types/electron'
import PreampControl from './PreampControl'
import { useI18n } from '../i18n'
import { withTimeout } from '../utils/withTimeout'

interface Props { profile: EqProfile; disabled?: boolean; onApplied?: () => Promise<void> | void; showPreamp?: boolean }
export default function ProfileEqCard({ profile, disabled = false, onApplied, showPreamp = false }: Props) {
  const { t } = useI18n()
  const [group, setGroup] = useState<AutoEqLibraryGroup | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const refresh = async () => { const groups = await window.electronAPI.getAutoEqLibrary(); setGroup(groups.find(item => item.id === profile) ?? null) }
  useEffect(() => { void refresh() }, [profile])
  const active = group?.files.find(file => file.filename === group.activeFilename)
  const apply = async (filename: string) => {
    setBusy(true)
    try {
      const result = await withTimeout(window.electronAPI.applySavedHeadphoneEq(profile, filename))
      if (result.success) { await refresh(); await onApplied?.(); window.dispatchEvent(new CustomEvent('astral-config-changed')); setOpen(false) }
    } finally {
      setBusy(false)
    }
  }
  return <>
    <Box p="4" borderRadius="14px" bg="rgba(255,255,255,.025)" border="1px solid rgba(255,255,255,.075)">
      <Flex align="center" gap="3"><Flex w="40px" h="40px" align="center" justify="center" borderRadius="11px" bg="rgba(139,92,246,.13)" color="purple.300"><FiHeadphones size="19" /></Flex><Box flex="1" minW="0"><Text color="white" fontWeight="750" fontSize="sm" truncate>{active ? `${active.headphoneName}${active.source ? ` - ${active.source}` : ''}` : t('eq.noHeadphone')}</Text><Text color="purple.200" fontSize="xs" fontWeight="650" truncate>{active?.target ?? t('eq.selectFor', { profile: group?.label ?? '' })}</Text>{active ? <Flex mt="1.5" gap="1.5"><StatusTag tone="purple">{group?.label}</StatusTag><StatusTag tone="blue">{t('eq.average')}</StatusTag></Flex> : null}</Box><AstralButton size="sm" variant="secondary" trailingIcon={<FiChevronRight />} onClick={() => setOpen(true)} disabled={disabled || busy || !group?.files.length}>{t('common.change')}</AstralButton></Flex>
      {showPreamp && active ? <Box mt="3" pt="3" borderTop="1px solid rgba(255,255,255,.06)"><PreampControl filterName={active.name} disabled={disabled || busy} configVersion={profile === 'atV1' ? 'v1' : profile === 'aiwV3' ? 'aiwv2' : 'aiwv5'} /></Box> : null}
    </Box>
    {open ? <Flex position="fixed" inset="0" zIndex="100" p="5" align="center" justify="center" bg="rgba(3,4,5,.88)" backdropFilter="blur(10px)" onMouseDown={event => event.target === event.currentTarget && setOpen(false)}><Box w="100%" maxW="600px" maxH="620px" overflow="hidden" borderRadius="16px" bg="#08090b" border="1px solid rgba(155,77,255,.35)" boxShadow="0 30px 90px rgba(0,0,0,.75)"><Flex p="5" align="center" justify="space-between" borderBottom="1px solid rgba(255,255,255,.07)"><Box><Text fontWeight="800">{t('eq.savedTitle', { profile: group?.label ?? '' })}</Text><Text color="whiteAlpha.400" fontSize="xs">{t('eq.savedSubtitle')}</Text></Box><Button minW="36px" h="36px" p="0" variant="ghost" aria-label={t('common.close')} onClick={() => setOpen(false)}><FiX /></Button></Flex><Box maxH="470px" overflowY="auto" p="3">{group?.files.map(file => { const selected = file.filename === group.activeFilename; return <Flex key={file.filename} p="3" align="center" gap="3" borderRadius="10px" bg={selected ? 'rgba(155,77,255,.11)' : 'transparent'} _hover={{ bg: 'rgba(255,255,255,.035)' }}><Box color="purple.300"><FiHeadphones /></Box><Box minW="0" flex="1"><Text fontSize="sm" fontWeight="700" truncate>{file.headphoneName}{file.source ? ` - ${file.source}` : ''}</Text><Text color="whiteAlpha.350" fontSize="10px">{file.target ?? group.label}</Text></Box>{selected ? <Flex color="green.300" align="center" gap="1"><FiCheck /><Text fontSize="10px">{t('common.active')}</Text></Flex> : <AstralButton size="sm" variant="secondary" disabled={busy} onClick={() => apply(file.filename)}>{t('common.use')}</AstralButton>}</Flex> })}</Box></Box></Flex> : null}
  </>
}
