import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Flex, Text, VStack } from '@chakra-ui/react'
import { FiCheckCircle, FiSliders } from 'react-icons/fi'
import AstralButton from './ui/AstralButton'
import AstralSelect from './ui/AstralSelect'
import StatusTag from './ui/StatusTag'
import type { V5ActiveState, V5Preset, V5Readiness } from '../types/electron'
import ProfileEqCard from './ProfileEqCard'
import { useI18n } from '../i18n'
import { withTimeout } from '../utils/withTimeout'

interface Props { disabled?: boolean }
const EMPTY_READINESS: V5Readiness = { presetLibrary: false, measurementsLibrary: false, targetsLibrary: false, plugins: { vstV1: false, vstV2: false, jsfxEngine: false, jsfxEnhancer: false } }
const EMPTY_ACTIVE: V5ActiveState = { tuneFilename: null, headphoneEqFilename: null, headphoneName: null, headphoneSource: null, headphoneChannel: null, headphoneTarget: null, headphoneFitError: null }

const prettyWeapon = (value: string) => value.replace(/Gun$/i, ' Gun').replace(/^UltraLo/i, 'Ultra Low').replace(/^Lo/i, 'Low').replace(/^Med/i, 'Medium').replace(/^Hi/i, 'High')
export default function V5Control({ disabled = false }: Props) {
  const { t } = useI18n()
  const [presets, setPresets] = useState<V5Preset[]>([])
  const [readiness, setReadiness] = useState(EMPTY_READINESS)
  const [, setActive] = useState(EMPTY_ACTIVE)
  const [profile, setProfile] = useState('')
  const [weapon, setWeapon] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const refreshActive = useCallback(async () => setActive(await window.electronAPI.getV5ActiveState()), [])

  useEffect(() => {
    Promise.all([window.electronAPI.getV5Readiness(), window.electronAPI.getV5Presets(), window.electronAPI.getV5ActiveState()]).then(([nextReadiness, nextPresets, nextActive]) => {
      setReadiness(nextReadiness); setPresets(nextPresets); setActive(nextActive)
      const current = nextPresets.find(item => item.filename === nextActive.tuneFilename)
      if (current) { setProfile(current.profile); setWeapon(current.weaponTuning) }
    })
  }, [])

  const profiles = useMemo(() => [...new Set(presets.map(item => item.profile))], [presets])
  const weapons = useMemo(() => [...new Set(presets.filter(item => item.profile === profile).map(item => item.weaponTuning))], [presets, profile])
  const selected = presets.find(item => item.profile === profile && item.weaponTuning === weapon)
  const ready = readiness.presetLibrary && readiness.plugins.vstV1 && readiness.plugins.vstV2

  const applyPreset = async () => {
    if (!selected) return
    setBusy(true); setMessage('')
    try {
      const result = await withTimeout(window.electronAPI.setV5Preset(selected.filename))
      if (result.success) { await refreshActive(); setMessage(t(result.restarted ? 'profiles.appliedRestarted' : 'profiles.appliedRestartPending')) }
      else setMessage(t('profiles.applyFailed', { code: result.code ?? t('common.unknown') }))
    } catch {
      setMessage(t('profiles.applyFailed', { code: t('common.unknown') }))
    } finally {
      setBusy(false)
    }
  }

  return <>
    <VStack gap="4" align="stretch">
      <Flex p="4" align="center" justify="space-between" borderRadius="16px" bg="linear-gradient(135deg, rgba(139,92,246,.15), rgba(59,130,246,.05))" border="1px solid rgba(139,92,246,.25)">
        <Flex gap="3" align="center"><Flex w="42px" h="42px" align="center" justify="center" borderRadius="12px" bg="rgba(139,92,246,.18)" color="purple.300"><FiSliders size="20" /></Flex><Box><Text color="white" fontWeight="800">AIW V5 · 16ch</Text><Text color="whiteAlpha.500" fontSize="xs">{t('profiles.v5Description')}</Text></Box></Flex>
        <StatusTag tone={ready ? 'green' : 'yellow'} icon={<FiCheckCircle />}>{t(ready ? 'common.ready' : 'profiles.missingInstall')}</StatusTag>
      </Flex>

      <ProfileEqCard profile="aiwV5" disabled={busy || disabled} onApplied={refreshActive} showPreamp />

      <Box p="4" borderRadius="16px" bg="rgba(255,255,255,.025)" border="1px solid rgba(255,255,255,.075)">
        <Text mb="3" color="purple.300" fontSize="xs" fontWeight="700" letterSpacing="wide">{t('profiles.v5Profile')}</Text>
        <Flex gap="3"><Box flex="1"><Text mb="1.5" color="whiteAlpha.500" fontSize="xs">{t('profiles.profile')}</Text><AstralSelect ariaLabel={t('profiles.profile')} value={profile} options={profiles.map(value => ({ value, label: value }))} onChange={value => { setProfile(value); setWeapon('') }} disabled={busy || disabled} /></Box><Box flex="1"><Text mb="1.5" color="whiteAlpha.500" fontSize="xs">{t('profiles.weaponSound')}</Text><AstralSelect ariaLabel={t('profiles.weaponSound')} value={weapon} options={weapons.map(value => ({ value, label: prettyWeapon(value) }))} onChange={setWeapon} disabled={!profile || busy || disabled} /></Box></Flex>
        <Flex mt="3" px="3" py="2.5" justify="space-between" borderRadius="10px" bg="rgba(139,92,246,.07)"><Text color="whiteAlpha.500" fontSize="xs">{t('profiles.virtualization')}</Text><Text color="white" fontSize="xs" fontWeight="700">Native 16ch</Text></Flex>
        <Box mt="3"><AstralButton fullWidth disabled={!selected || !ready || busy || disabled} onClick={applyPreset}>{t(busy ? 'profiles.applying' : 'profiles.applyV5')}</AstralButton></Box>
      </Box>
      {message ? <Text color="purple.200" fontSize="xs">{message}</Text> : null}
    </VStack>
  </>
}
