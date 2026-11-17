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
const EMPTY_READINESS: V5Readiness = { presetLibrary: false, measurementsLibrary: false, targetsLibrary: false, plugins: { vstCharlie:false, vstV1: false, vstV2: false, jsfxEngine: false, jsfxEnhancer: false } }
const EMPTY_ACTIVE: V5ActiveState = { tuneFilename: null, headphoneEqFilename: null, headphoneName: null, headphoneSource: null, headphoneChannel: null, headphoneTarget: null, headphoneFitError: null }

const prettyWeapon = (value: string) => value.replace(/Gun$/i, ' Gun').replace(/^UltraLo/i, 'Ultra Low').replace(/^Lo/i, 'Low').replace(/^Med/i, 'Medium').replace(/^Hi/i, 'High')
export default function V5Control({ disabled = false }: Props) {
  const { t } = useI18n()
  const [presets, setPresets] = useState<V5Preset[]>([])
  const [readiness, setReadiness] = useState(EMPTY_READINESS)
  const [, setActive] = useState(EMPTY_ACTIVE)
  const [game,setGame]=useState<'BO7'|'MW4'>('BO7')
  const [hrir,setHrir]=useState('KEMAR')
  const [profile, setProfile] = useState('')
  const [weapon, setWeapon] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [needsEq,setNeedsEq]=useState(false)
  const [generation,setGeneration]=useState<number|null>(null)
  useEffect(()=>window.electronAPI.onAutoEqProgress(p=>setGeneration(p.percent)),[])

  const refreshActive = useCallback(async () => setActive(await window.electronAPI.getV5ActiveState()), [])

  useEffect(() => {
    let live = true
    const refresh = () => { void Promise.all([window.electronAPI.getV5Readiness(), window.electronAPI.getV5Presets(), window.electronAPI.getV5ActiveState()]).then(([nextReadiness, nextPresets, nextActive]) => {
      if (!live) return
      setReadiness(nextReadiness); setPresets(nextPresets); setActive(nextActive)
      const current = nextPresets.find(item => item.filename === nextActive.tuneFilename)
      if (current) { setGame(current.game);setHrir(current.hrir);setProfile(current.profile); setWeapon(current.weaponTuning) }
      else if(nextPresets.length)setGame(nextPresets[0].game)
    }).catch(() => { if(live) setMessage(t('profiles.applyFailed', {code:'CATALOG_REFRESH_FAILED'})) }) }
    refresh()
    window.addEventListener('astral-config-changed', refresh)
    return () => { live=false; window.removeEventListener('astral-config-changed', refresh) }
  }, [])

  const profiles = useMemo(() => [...new Set(presets.filter(item=>item.game===game).map(item => item.profile))], [presets,game])
  const weapons = useMemo(() => [...new Set(presets.filter(item => item.game===game && item.profile === profile).map(item => item.weaponTuning))], [presets, profile,game])
  const selected = presets.find(item => item.game===game && item.profile === profile && item.weaponTuning === weapon && (game==='BO7'||item.hrir===hrir))
  const ready = readiness.presetLibrary && (game==='MW4'?readiness.plugins.vstCharlie:readiness.plugins.vstV1 && readiness.plugins.vstV2)

  const applyPreset = async (generate = false) => {
    if (!selected) return
    setBusy(true); setMessage(''); setNeedsEq(false); setGeneration(generate?0:null)
    try {
      const result = await withTimeout(window.electronAPI.setV5Preset(selected.filename,generate), generate ? 180000 : 30000)
      if (result.success) { await refreshActive(); setMessage(t(result.restarted ? 'profiles.appliedRestarted' : 'profiles.appliedRestartPending')) }
      else { setNeedsEq(result.code === 'V5_GAME_EQ_REQUIRED'); setMessage(result.code === 'V5_GAME_EQ_REQUIRED' ? t('profiles.gameEqRequired') : t('profiles.applyFailed', { code: result.code ?? t('common.unknown') })) }
    } catch {
      setMessage(t('profiles.applyFailed', { code: t('common.unknown') }))
    } finally {
      setBusy(false)
    }
  }

  return <>
    <VStack gap="4" align="stretch">
      <Flex p="4" align="center" justify="space-between" borderRadius="16px" bg="linear-gradient(135deg, rgba(139,92,246,.15), rgba(59,130,246,.05))" border="1px solid rgba(139,92,246,.25)">
        <Flex gap="3" align="center"><Flex w="42px" h="42px" align="center" justify="center" borderRadius="12px" bg="rgba(139,92,246,.18)" color="purple.300"><FiSliders size="20" /></Flex><Box><Text color="white" fontWeight="800">AIW V5 · 16ch</Text><Text color="whiteAlpha.500" fontSize="xs">{t('profiles.v5Description',{game})}</Text></Box></Flex>
        <StatusTag tone={ready ? 'green' : 'yellow'} icon={<FiCheckCircle />}>{t(ready ? 'common.ready' : 'profiles.missingInstall')}</StatusTag>
      </Flex>

      <ProfileEqCard profile="aiwV5" disabled={busy || disabled} onApplied={refreshActive} showPreamp />

      <Box p="4" borderRadius="16px" bg="rgba(255,255,255,.025)" border="1px solid rgba(255,255,255,.075)">
        <Text mb="3" color="purple.300" fontSize="xs" fontWeight="700" letterSpacing="wide">{t('profiles.v5Profile')}</Text>
        <Flex gap="3" wrap="wrap"><Box flex="1" minW="140px"><Text mb="1.5" color="whiteAlpha.500" fontSize="xs">{t('profiles.game')}</Text><AstralSelect ariaLabel={t('profiles.game')} value={game} options={[...new Set(presets.map(p=>p.game))].map(value=>({value,label:value}))} onChange={value=>{setGame(value as 'BO7'|'MW4');setProfile('');setWeapon('');setHrir('KEMAR')}} disabled={busy||disabled}/></Box><Box flex="1"><Text mb="1.5" color="whiteAlpha.500" fontSize="xs">{t('profiles.profile')}</Text><AstralSelect ariaLabel={t('profiles.profile')} value={profile} options={profiles.map(value => ({ value, label: value }))} onChange={value => { setProfile(value); setWeapon('') }} disabled={busy || disabled} /></Box><Box flex="1"><Text mb="1.5" color="whiteAlpha.500" fontSize="xs">{t('profiles.weaponSound')}</Text><AstralSelect ariaLabel={t('profiles.weaponSound')} value={weapon} options={weapons.map(value => ({ value, label: prettyWeapon(value) }))} onChange={setWeapon} disabled={!profile || busy || disabled} /></Box></Flex>
        <Box mt="3">{game==='MW4'?<AstralSelect ariaLabel="HRIR" value={hrir} options={[{value:'KEMAR',label:'HRIR KEMAR'},{value:'KU100',label:'HRIR KU100'}]} onChange={setHrir} disabled={busy||disabled}/>:null}</Box>
        <Flex mt="3" px="3" py="2.5" justify="space-between" borderRadius="10px" bg="rgba(139,92,246,.07)"><Text color="whiteAlpha.500" fontSize="xs">{t('profiles.virtualization')}</Text><Text color="white" fontSize="xs" fontWeight="700">{game==='MW4'?'HRIR '+hrir:'Native 16ch'}</Text></Flex>
        <Box mt="3"><AstralButton fullWidth disabled={!selected || !ready || busy || disabled} onClick={()=>void applyPreset()}>{t(busy ? 'profiles.applying' : 'profiles.applyV5')}</AstralButton></Box>
      </Box>
      {needsEq ? <AstralButton disabled={busy||disabled||!selected} onClick={()=>void applyPreset(true)}>{t('profiles.generateNow')}</AstralButton> : null}
      {busy && generation!==null ? <Text fontSize="xs" color="purple.200">{t('profiles.generatingEq', {percent:generation})}</Text> : null}
      {message ? <Text color="purple.200" fontSize="xs">{message}</Text> : null}
    </VStack>
  </>
}
