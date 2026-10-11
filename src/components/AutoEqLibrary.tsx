import { useEffect, useMemo, useState } from 'react'
import { Box, Flex, Input, Text, VStack, chakra } from '@chakra-ui/react'
import { FiCheck, FiHeadphones, FiPlus, FiSearch, FiTrash2, FiX } from 'react-icons/fi'
import HeadphoneEqModal from './HeadphoneEqModal'
import AstralButton from './ui/AstralButton'
import type { AutoEqLibraryGroup, EqProfile, SavedEqFiles } from '../types/electron'
import { useI18n } from '../i18n'
import { withTimeout } from '../utils/withTimeout'

const PROFILE_ORDER: EqProfile[] = ['atV1', 'aiwV3', 'aiwV5']
type AutoEqFile = AutoEqLibraryGroup['files'][number]

interface ProfileCellProps {
  group?: AutoEqLibraryGroup
  file?: AutoEqFile
  busy: boolean
  onApply: (profile: EqProfile, filename: string) => void
}

function ProfileCell({ group, file, busy, onApply }: ProfileCellProps) {
  const { t } = useI18n()
  const active = Boolean(file && group?.activeFilename?.toLocaleLowerCase() === file.filename.toLocaleLowerCase())
  return <Flex w="92px" h="42px" px="2" align="center" justify="space-between" gap="1.5" borderRadius="9px" bg={active ? 'rgba(34,197,94,.07)' : 'rgba(0,0,0,.2)'} border="1px solid" borderColor={active ? 'rgba(34,197,94,.25)' : 'rgba(255,255,255,.065)'}>
    <Box minW="0"><Text fontSize="9px" fontWeight="800" color={active ? 'green.200' : 'whiteAlpha.650'}>{group?.label}</Text><Text mt="0.5" fontSize="9px" color={active ? 'green.300' : file ? 'whiteAlpha.450' : 'yellow.300'} truncate>{active ? t('common.active') : file ? t('common.use') : t('eq.notGenerated')}</Text></Box>
    {active ? <Box color="green.300"><FiCheck size="12" /></Box> : file ? <chakra.button type="button" w="24px" h="24px" flexShrink="0" display="flex" alignItems="center" justifyContent="center" borderRadius="7px" border="1px solid rgba(155,77,255,.35)" color="purple.200" cursor={busy ? 'not-allowed' : 'pointer'} opacity={busy ? .45 : 1} disabled={busy} aria-label={`${t('common.use')} ${group?.label ?? ''}`} onClick={() => onApply(group!.id, file.filename)} _hover={busy ? {} : { bg: 'rgba(155,77,255,.13)', borderColor: 'purple.400' }}><FiCheck size="11" /></chakra.button> : null}
  </Flex>
}

export default function AutoEqLibrary() {
  const { t } = useI18n()
  const [groups, setGroups] = useState<AutoEqLibraryGroup[]>([])
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [busyKey, setBusyKey] = useState('')
  const [pendingDelete, setPendingDelete] = useState('')
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const refresh = async () => setGroups(await window.electronAPI.getAutoEqLibrary())
  useEffect(() => { void refresh() }, [])

  const headphones = useMemo(() => {
    const records = new Map<string, { name: string; versions: Partial<Record<EqProfile, AutoEqFile>> }>()
    groups.forEach(group => group.files.forEach(file => {
      const key = file.name.toLocaleLowerCase()
      const displayName = `${file.headphoneName}${file.source ? ` - ${file.source}` : ''}`
      const record = records.get(key) ?? { name: displayName, versions: {} }
      record.versions[group.id] = file
      records.set(key, record)
    }))
    const normalized = query.trim().toLocaleLowerCase()
    return [...records.values()].filter(item => !normalized || item.name.toLocaleLowerCase().includes(normalized)).sort((left, right) => left.name.localeCompare(right.name))
  }, [groups, query])

  const apply = async (profile: EqProfile, filename: string) => {
    const key = `${profile}:${filename}`
    setBusyKey(key)
    setMessage(null)
    try {
      const result = await withTimeout(window.electronAPI.applySavedHeadphoneEq(profile, filename))
      if (!result.success) {
        setMessage({ text: t('autoeq.applyFailed', { code: result.code ?? t('common.unknown') }), error: true })
        return
      }
      await refresh()
      window.dispatchEvent(new CustomEvent('astral-config-changed'))
    } catch {
      setMessage({ text: t('autoeq.applyFailed', { code: t('common.unknown') }), error: true })
    } finally { setBusyKey('') }
  }

  const remove = async (name: string, versions: Partial<Record<EqProfile, AutoEqFile>>) => {
    const files = Object.fromEntries(PROFILE_ORDER.flatMap(profile => versions[profile] ? [[profile, versions[profile]!.filename]] : [])) as SavedEqFiles
    setBusyKey(`delete:${name}`)
    setMessage(null)
    try {
      const result = await window.electronAPI.deleteSavedHeadphoneEq(files)
      if (!result.success) {
        const text = result.code === 'EQ_IN_USE' ? t('eq.deleteActiveBlocked') : result.code === 'PROTECTED_EQ' ? t('eq.protected') : t('eq.deleteFailed', { code: result.code ?? t('common.unknown') })
        setMessage({ text, error: true })
        return
      }
      setPendingDelete('')
      setMessage({ text: t('eq.deleteSuccess'), error: false })
      await refresh()
      window.dispatchEvent(new CustomEvent('astral-config-changed'))
    } catch {
      setMessage({ text: t('eq.deleteFailed', { code: t('common.unknown') }), error: true })
    } finally { setBusyKey('') }
  }

  return <>
    <VStack gap="3" align="stretch">
      <Flex align="center" justify="space-between" gap="4"><Box><Text fontSize="sm" fontWeight="800">{t('eq.savedHeadphones')}</Text><Text color="whiteAlpha.400" fontSize="xs">{t('eq.independentProfiles')}</Text></Box><AstralButton trailingIcon={<FiPlus />} onClick={() => setModalOpen(true)}>{t('eq.addHeadphone')}</AstralButton></Flex>
      <Flex align="center" gap="2" px="3" borderRadius="10px" bg="rgba(255,255,255,.025)" border="1px solid rgba(255,255,255,.08)" _focusWithin={{ borderColor: 'purple.400', boxShadow: '0 0 0 3px rgba(139,92,246,.1)' }}><Box color="whiteAlpha.350"><FiSearch /></Box><Input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('eq.searchSaved')} h="38px" px="0" border="0" outline="none" boxShadow="none" fontSize="sm" /></Flex>
      {message ? <Text px="1" color={message.error ? 'red.300' : 'green.300'} fontSize="11px">{message.text}</Text> : null}
      <VStack gap="2" align="stretch">{headphones.map(headphone => {
        const active = PROFILE_ORDER.some(profile => {
          const file = headphone.versions[profile]
          return Boolean(file && groups.find(group => group.id === profile)?.activeFilename?.toLocaleLowerCase() === file.filename.toLocaleLowerCase())
        })
        const protectedEq = PROFILE_ORDER.some(profile => headphone.versions[profile]?.filename.toLocaleLowerCase() === 'flat.txt')
        const confirming = pendingDelete === headphone.name
        const deleting = busyKey === `delete:${headphone.name}`
        const deleteBlocked = active || protectedEq || Boolean(busyKey)
        const deleteTitle = active ? t('eq.deleteActiveBlocked') : protectedEq ? t('eq.protected') : t('eq.delete')
        return <Flex key={headphone.name} minH="66px" px="3" py="2" align="center" gap="3" borderRadius="12px" bg="rgba(255,255,255,.022)" border="1px solid rgba(255,255,255,.075)">
          <Flex w="34px" h="34px" flexShrink="0" align="center" justify="center" borderRadius="9px" bg="rgba(139,92,246,.13)" color="purple.300"><FiHeadphones size="16" /></Flex>
          <Box flex="1" minW="0"><Text color="white" fontSize="12px" fontWeight="750" truncate>{headphone.name}</Text><Text color="purple.200" fontSize="9px">{t('eq.savedAutoEq')}</Text></Box>
          <Flex gap="1.5">{PROFILE_ORDER.map(profile => <ProfileCell key={profile} group={groups.find(item => item.id === profile)} file={headphone.versions[profile]} busy={Boolean(busyKey)} onApply={apply} />)}</Flex>
          {confirming ? <Flex minW="116px" justify="end" gap="1.5"><chakra.button type="button" w="30px" h="30px" display="flex" alignItems="center" justifyContent="center" borderRadius="8px" color="whiteAlpha.550" aria-label={t('common.cancel')} title={t('common.cancel')} onClick={() => setPendingDelete('')}><FiX /></chakra.button><chakra.button type="button" h="30px" px="2.5" borderRadius="8px" border="1px solid rgba(251,113,133,.4)" bg="rgba(251,113,133,.1)" color="red.300" fontSize="10px" fontWeight="750" disabled={deleting} onClick={() => void remove(headphone.name, headphone.versions)}>{t('eq.deleteConfirm')}</chakra.button></Flex> : <chakra.button type="button" w="32px" h="32px" flexShrink="0" display="flex" alignItems="center" justifyContent="center" borderRadius="9px" color="whiteAlpha.350" cursor={deleteBlocked ? 'not-allowed' : 'pointer'} opacity={deleteBlocked ? .3 : 1} disabled={deleteBlocked} aria-label={deleteTitle} title={deleteTitle} onClick={() => setPendingDelete(headphone.name)} _hover={deleteBlocked ? {} : { color: 'red.300', bg: 'rgba(251,113,133,.08)' }}><FiTrash2 size="14" /></chakra.button>}
        </Flex>
      })}
        {!headphones.length ? <Flex h="160px" align="center" justify="center" borderRadius="12px" border="1px dashed rgba(255,255,255,.1)"><Text color="whiteAlpha.350" fontSize="sm">{t('eq.noSavedMatches')}</Text></Flex> : null}
      </VStack>
    </VStack>
    <HeadphoneEqModal open={modalOpen} onClose={() => setModalOpen(false)} onApplied={async () => { await refresh(); window.dispatchEvent(new CustomEvent('astral-config-changed')) }} />
  </>
}
