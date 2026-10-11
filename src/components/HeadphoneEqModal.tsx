import { useEffect, useState } from 'react'
import { Box, Button, Flex, Input, Progress, Text } from '@chakra-ui/react'
import { FiHeadphones, FiSearch, FiX } from 'react-icons/fi'
import type { AutoEqGenerationProgress, HeadphoneEq } from '../types/electron'
import AstralButton from './ui/AstralButton'
import StatusTag from './ui/StatusTag'
import { useI18n } from '../i18n'

interface Props {
  open: boolean
  disabled?: boolean
  onClose: () => void
  onApplied: () => Promise<void> | void
}

function measurementSource(source: string | undefined, localMeasurement: string) {
  if (!source || source === 'local') return { platform: 'Astral', reviewer: localMeasurement }
  const [family, ...ownerParts] = source.split('/')
  return {
    platform: family === 'Squig' ? 'Squiglink' : family === 'AutoEq' ? 'AutoEq' : family,
    reviewer: ownerParts.join(' / ') || family,
  }
}

export default function HeadphoneEqModal({ open, disabled, onClose, onApplied }: Props) {
  const { t, language } = useI18n()
  const [query, setQuery] = useState('')
  const [type, setType] = useState<'all' | 'IEM' | 'Headphone'>('all')
  const [results, setResults] = useState<HeadphoneEq[]>([])
  const [selected, setSelected] = useState<HeadphoneEq | null>(null)
  const [total, setTotal] = useState(0)
  const [matches, setMatches] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<AutoEqGenerationProgress | null>(null)

  useEffect(() => {
    if (!open) return
    return window.electronAPI.onAutoEqProgress(setProgress)
  }, [open])

  useEffect(() => {
    if (!open) return
    let live = true
    const timer = window.setTimeout(() => {
      window.electronAPI.searchHeadphoneEqs(query, 80, type).then(value => {
        if (!live) return
        setResults(value.results)
        setTotal(value.total)
        setMatches(value.matchCount)
      })
    }, 160)
    return () => { live = false; window.clearTimeout(timer) }
  }, [open, query, type])

  if (!open) return null

  const apply = async () => {
    if (!selected) return
    setBusy(true)
    setError('')
    setProgress({ completed: 0, total: 3, profile: 'AT V1', phase: 'generating', percent: 0 })
    const result = await window.electronAPI.setV5HeadphoneEq(selected.relativePath)
    if (result.success) {
      await onApplied()
      onClose()
    } else {
      setError(t('autoeq.applyFailed', { code: result.code ?? t('common.unknown') }))
    }
    setBusy(false)
  }

  return (
    <Flex position="fixed" inset="0" zIndex="100" align="center" justify="center" p="5" bg="rgba(3,4,5,.88)" backdropFilter="blur(10px)" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <Box w="100%" maxW="720px" maxH="calc(100vh - 44px)" overflow="hidden" borderRadius="16px" bg="#08090b" border="1px solid rgba(155,77,255,.35)" boxShadow="0 30px 90px rgba(0,0,0,.75), 0 0 35px rgba(155,77,255,.09)">
        <Flex align="center" justify="space-between" p="5" borderBottom="1px solid rgba(255,255,255,.07)">
          <Flex align="center" gap="3">
            <Flex w="40px" h="40px" align="center" justify="center" borderRadius="12px" bg="rgba(139,92,246,.16)" color="purple.300"><FiHeadphones size="20" /></Flex>
            <Box><Text color="white" fontWeight="800">{t('autoeq.modalTitle')}</Text><Text color="whiteAlpha.500" fontSize="xs">{t('autoeq.modalSubtitle')}</Text></Box>
          </Flex>
          <Button minW="36px" h="36px" p="0" variant="ghost" color="whiteAlpha.600" onClick={onClose} aria-label={t('common.close')}><FiX /></Button>
        </Flex>

        <Box p="5">
          <Flex align="center" gap="2" px="3" borderRadius="12px" bg="rgba(255,255,255,.035)" border="1px solid rgba(255,255,255,.09)" _focusWithin={{ borderColor: 'purple.400', boxShadow: '0 0 0 3px rgba(139,92,246,.12)' }}>
            <Box color="whiteAlpha.400"><FiSearch /></Box>
            <Input value={query} onChange={event => { setQuery(event.target.value); setSelected(null) }} placeholder={t('autoeq.searchPlaceholder')} border="0" outline="none" boxShadow="none" px="0" h="44px" disabled={busy || disabled} />
          </Flex>
          <Flex mt="3" align="center" justify="space-between" gap="3">
            <Text color="whiteAlpha.500" fontSize="xs">{t(query.trim() ? 'autoeq.matches' : 'autoeq.available', { count: (query.trim() ? matches : total).toLocaleString(language) })}</Text>
            <Flex gap="1.5">{([['all',t('autoeq.all')],['IEM','IEM'],['Headphone',t('autoeq.headphones')]] as const).map(([value,label]) => <Button key={value} size="xs" px="3" borderRadius="9px" variant={type === value ? 'solid' : 'outline'} colorPalette="purple" onClick={() => { setType(value); setSelected(null) }}>{label}</Button>)}</Flex>
          </Flex>

          <Box mt="4" h="310px" overflowY="auto" borderRadius="14px" border="1px solid rgba(255,255,255,.07)" bg="rgba(0,0,0,.2)" css={{ '&::-webkit-scrollbar': { width: '5px' }, '&::-webkit-scrollbar-thumb': { background: 'rgba(139,92,246,.5)', borderRadius: '9px' } }}>
            {results.length ? results.map(eq => {
              const active = selected?.id === eq.id
              const source = measurementSource(eq.source, t('autoeq.localMeasurement'))
              return <Flex key={eq.id} align="center" gap="3" p="3.5" borderBottom="1px solid rgba(255,255,255,.055)" bg={active ? 'rgba(139,92,246,.14)' : 'transparent'} _hover={{ bg: active ? 'rgba(139,92,246,.14)' : 'rgba(255,255,255,.025)' }}>
                <Flex w="34px" h="34px" flexShrink="0" align="center" justify="center" borderRadius="10px" bg="rgba(255,255,255,.045)" color="purple.300"><FiHeadphones /></Flex>
                <Box minW="0" flex="1">
                  <Text color="white" fontSize="sm" fontWeight="700" truncate>{eq.name}</Text>
                  <Flex gap="1.5" mt="1.5" align="center" wrap="wrap">
                    {eq.type && eq.type !== 'Unknown' ? <StatusTag tone="purple">{eq.type}</StatusTag> : null}
                    <StatusTag tone={source.platform === 'Squiglink' ? 'orange' : 'blue'}>{source.platform}</StatusTag>
                    <Text color="whiteAlpha.450" fontSize="10px">{t('autoeq.measuredBy')}</Text>
                    <Text color="purple.200" fontSize="10px" fontWeight="700">{source.reviewer}</Text>
                  </Flex>
                </Box>
                <AstralButton size="sm" variant={active ? 'secondary' : 'primary'} onClick={() => setSelected(eq)}>{t(active ? 'autoeq.selected' : 'common.use')}</AstralButton>
              </Flex>
            }) : <Flex h="100%" align="center" justify="center"><Text color="whiteAlpha.400" fontSize="sm">{t('autoeq.noResults')}</Text></Flex>}
          </Box>
          {selected ? <Flex mt="3" gap="2" align="center" wrap="wrap" px="3" py="2.5" borderRadius="11px" bg="rgba(139,92,246,.07)" border="1px solid rgba(139,92,246,.16)"><Text mr="auto" color="whiteAlpha.700" fontSize="xs" fontWeight="700">{t('autoeq.configuration')}</Text><StatusTag tone="purple">AT V1 · AIW V3 · AIW V5</StatusTag><StatusTag tone="blue">{t('eq.average')}</StatusTag><StatusTag tone="green">20–7500 Hz</StatusTag></Flex> : null}
          {busy && progress ? <Box mt="3" px="3" py="3" borderRadius="11px" bg="rgba(139,92,246,.075)" border="1px solid rgba(139,92,246,.2)">
            <Flex mb="2" align="center" justify="space-between"><Text color="whiteAlpha.800" fontSize="xs" fontWeight="700">{t(progress.phase === 'generating' ? 'autoeq.generatingProfile' : 'autoeq.profileComplete', { profile: progress.profile })}</Text><Text color="purple.200" fontSize="xs" fontWeight="800">{progress.completed}/3</Text></Flex>
            <Progress.Root value={progress.percent} colorPalette="purple" size="sm"><Progress.Track borderRadius="full" bg="whiteAlpha.100"><Progress.Range borderRadius="full" /></Progress.Track></Progress.Root>
            <Flex mt="2" justify="space-between">{(['AT V1', 'AIW V3', 'AIW V5'] as const).map((label, index) => <Text key={label} color={progress.completed > index ? 'green.300' : 'whiteAlpha.350'} fontSize="9px" fontWeight="700">{progress.completed > index ? '✓ ' : ''}{label}</Text>)}</Flex>
          </Box> : null}
          {error ? <Text mt="3" color="red.300" fontSize="xs">{error}</Text> : null}
          <Flex mt="4" gap="3" justify="flex-end"><AstralButton variant="ghost" onClick={onClose}>{t('common.cancel')}</AstralButton><AstralButton disabled={!selected || busy || disabled} onClick={apply}>{t(busy ? 'autoeq.generating' : 'autoeq.generateApply')}</AstralButton></Flex>
        </Box>
      </Box>
    </Flex>
  )
}
