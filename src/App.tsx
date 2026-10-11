import Diagnostics from './components/Diagnostics'
import CosmicAudioStatus from './components/CosmicAudioStatus'
import AudioBrand from './components/AudioBrand'
import AudioAccessGate from './components/AudioAccessGate'
import { useEffect, useState } from 'react'
import { Box, Flex, Icon, Text, VStack } from '@chakra-ui/react'
import { FiActivity, FiCheckCircle, FiHeadphones, FiSliders, FiVolume2 } from 'react-icons/fi'
import { LuWaves } from 'react-icons/lu'
import type { IconType } from 'react-icons'
import TitleBar from './components/TitleBar'
import PluginControl from './components/PluginControl'
import ConfigSelector from './components/ConfigSelector'
import V2SubOptions from './components/V2SubOptions'
import V5Control from './components/V5Control'
import ChannelConfigControl from './components/ChannelConfigControl'
import LegacyProfileControl from './components/LegacyProfileControl'
import AutoEqLibrary from './components/AutoEqLibrary'
import SidebarAudioActions from './components/SidebarAudioActions'
import PickerUpdateControl from './components/PickerUpdateControl'
import type { AutoEqLibraryGroup } from './types/electron'
import { useI18n, type TranslationKey } from './i18n'

type Selection = 'none' | 'v1' | 'v2' | 'aiwv2' | 'aiwv5' | 'custom'
type Section = 'profiles' | 'autoeq' | 'diagnostics'
interface ConfigState { mainConfig: Selection; v2Subs: Record<string, boolean> }
const nav: Array<{ id: Section; label: TranslationKey; icon: IconType }> = [
  { id: 'profiles', label: 'nav.profiles', icon: FiSliders },
  { id: 'autoeq', label: 'nav.autoeq', icon: FiHeadphones },
  { id: 'diagnostics', label: 'diagnostics.title', icon: FiActivity },
]

export default function App() {
  const { t } = useI18n()
  const [customOpen, setCustomOpen] = useState(false)
  const [section, setSection] = useState<Section>('profiles')
  const [config, setConfig] = useState<ConfigState>({ mainConfig: 'none', v2Subs: {} })
  const [eqLibrary, setEqLibrary] = useState<AutoEqLibraryGroup[]>([])
  const [exists, setExists] = useState(true)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const refresh = async () => {
    const found = await window.electronAPI.checkConfigExists()
    setExists(found)
    const [nextConfig, nextLibrary] = await Promise.all([
      found ? window.electronAPI.getConfigState() : Promise.resolve(null),
      found ? window.electronAPI.getAutoEqLibrary() : Promise.resolve([]),
    ])
    if (nextConfig) setConfig(nextConfig)
    setEqLibrary(nextLibrary)
    setLoading(false)
  }
  useEffect(() => {
    void refresh()
    const refreshFromChange = () => { void refresh() }
    window.addEventListener('astral-config-changed', refreshFromChange)
    return () => window.removeEventListener('astral-config-changed', refreshFromChange)
  }, [])

  const selectProfile = async (value: Selection) => {
    if (applying) return
    setApplying(true); setStatus(t('common.applying'))
    try {
      const result = await window.electronAPI.setMainConfig(value)
      if (result.success) { setConfig(result.state); setStatus(t('common.applied')); await refresh() }
      else setStatus(t(result.code === 'CUSTOM_OUTPUT_NOT_INSTALLED' ? 'profiles.cosmicMissing' : 'common.failed'))
    } catch { setStatus(t('common.failed')) }
    finally { setApplying(false) }
  }
  const selectV2 = async (key: string) => {
    setApplying(true); const result = await window.electronAPI.setV2Sub(key)
    if (result.success) setConfig(result.state)
    setApplying(false)
  }

  const activeEqGroupId = config.mainConfig === 'v1' ? 'atV1' : config.mainConfig === 'aiwv2' ? 'aiwV3' : config.mainConfig === 'aiwv5' ? 'aiwV5' : null
  const activeEqGroup = eqLibrary.find(group => group.id === activeEqGroupId)
  const activeEqFile = activeEqGroup?.files.find(file => file.filename === activeEqGroup.activeFilename)
  const activeEqName = activeEqFile ? `${activeEqFile.headphoneName}${activeEqFile.source ? ` - ${activeEqFile.source}` : ''}` : t('status.noHeadphoneEq')
  const activeEqSource = activeEqFile?.target ?? t('status.flatResponse')
  const activeV2Sub = Object.entries(config.v2Subs).find(([, enabled]) => enabled)?.[0]?.replace(/^v/i, '').toUpperCase() ?? 'V2'
  const routeSummary = config.mainConfig === 'custom' ? 'Cosmic - 16ch' : config.mainConfig === 'aiwv5' ? 'BO7 · V5 · 16ch' : config.mainConfig === 'aiwv2' ? 'BO7 · AIW V3 · 7.1' : config.mainConfig === 'v1' ? 'BO7 · AT V1 · 7.1' : config.mainConfig === 'v2' ? `BO7 · AT ${activeV2Sub} · 7.1` : t('status.processingDisabledShort')
  const routeDetail = (config.mainConfig === 'aiwv5' || config.mainConfig === 'custom') ? t('status.nativeProcessing') : config.mainConfig === 'none' ? t('status.eapoBypassed') : t('status.cableProcessing')
  const tunedDevice = (config.mainConfig === 'aiwv5' || config.mainConfig === 'custom') ? 'CABLE In 16ch' : config.mainConfig === 'none' ? t('status.noRoutedDevice') : 'Cable Input 7.1'
  const tunedDeviceDetail = (config.mainConfig === 'aiwv5' || config.mainConfig === 'custom') ? 'VB-Audio · 16ch' : config.mainConfig === 'none' ? t('common.off') : 'VB-Audio · 7.1'
  const displayProfile = config.mainConfig === 'custom' ? 'Cosmic' : config.mainConfig === 'aiwv5' ? 'AIW V5' : config.mainConfig === 'aiwv2' ? 'AIW V3' : config.mainConfig === 'v1' ? 'AT V1' : config.mainConfig === 'v2' ? 'AT V2' : t('common.none')

  return <Box className="audio-shell" w="100vw" h="100vh" overflow="hidden" borderRadius="18px" bg="#030405" color="white" position="relative">
    <TitleBar /><AudioAccessGate>
    <Flex className="core-picker-frame" position="absolute" inset="44px 0 0 0">
      <Box className="audio-sidebar" w="236px" flexShrink="0" p="3"><AudioBrand/><div className="audio-nav-caption">{t('design.workspaceLabel')}</div>
        <VStack gap="1" align="stretch">{nav.map(item => {
          const selected = item.id === section
          return <Flex className="audio-nav-item" aria-current={selected?'page':undefined} key={item.id} as="button" position="relative" align="center" gap="3" h="66px" px="3" borderRadius="8px" bg={selected ? 'rgba(155,77,255,.105)' : 'transparent'} color={selected ? 'white' : 'whiteAlpha.500'} cursor="pointer" transition="160ms" _hover={{ bg: selected ? 'rgba(155,77,255,.13)' : 'rgba(255,255,255,.035)', color: 'white' }} onClick={() => setSection(item.id)}>
            {selected ? <Box position="absolute" left="-12px" w="3px" h="22px" borderRightRadius="3px" bg="#9b4dff" boxShadow="0 0 14px rgba(155,77,255,.6)" /> : null}<Icon as={item.icon} boxSize="4" /><Text fontSize="sm" fontWeight={selected ? '700' : '500'}>{t(item.label)}<Text as="span" display="block" mt="1" fontSize="11px" fontWeight="400" color="#8c8c96">{t(item.id==='profiles'?'design.profilesNav':item.id==='diagnostics'?'diagnostics.subtitle':'design.eqNav')}</Text></Text>
          </Flex>
        })}</VStack>
        <Box className="audio-sidebar-tools" mt="auto" pt="5"><SidebarAudioActions /><PickerUpdateControl /><Box mt="2" p="3" borderRadius="10px" bg="#100d13" border="1px solid rgba(255,255,255,.065)"><Flex align="center" gap="2" color={exists ? 'green.300' : 'red.300'}><FiCheckCircle size="13" /><Text fontSize="11px" fontWeight="700">Equalizer APO</Text></Flex><Text mt="1" color="whiteAlpha.350" fontSize="10px">{t(exists ? 'status.configurationDetected' : 'status.installationRequired')}</Text></Box></Box>
      </Box>

      <Flex flex="1" minW="0" direction="column" className="audio-main"><header className="core-topbar"><strong>{t(section==='profiles'?'profiles.title':section==='diagnostics'?'diagnostics.title':'autoeq.title')}</strong><span>{t(section==='profiles'?'profiles.subtitle':section==='diagnostics'?'diagnostics.subtitle':'autoeq.subtitle')}</span></header>
        <Box className="audio-scroll" flex="1" minH="0" overflowY="auto" px="7" pt="6" pb="5" css={{ '&::-webkit-scrollbar': { width: '5px' }, '&::-webkit-scrollbar-thumb': { background: 'rgba(155,77,255,.3)', borderRadius: '6px' } }}>
          <Box maxW="1120px" mx="auto">
            <Text fontSize="38px" fontWeight="600" letterSpacing="-.035em">{t(section === 'profiles' ? 'profiles.title' : section==='diagnostics'?'diagnostics.title':'autoeq.title')}</Text><Text mt="1" mb="6" color="#a3a3a3" fontSize="sm">{t(section === 'profiles' ? 'profiles.subtitle' : section==='diagnostics'?'diagnostics.subtitle':'autoeq.subtitle')}</Text>
            {loading ? <Text color="whiteAlpha.400">{t('status.loadingConfig')}</Text> : !exists ? <Box p="5" bg="#100d13" border="1px solid rgba(251,113,133,.3)" borderRadius="10px"><Text color="red.300">{t('status.configMissing')}</Text></Box> : null}
            {!loading && exists && section === 'profiles' ? <VStack gap="5" align="stretch">
              <ConfigSelector currentSelection={config.mainConfig} onSelect={value => {setCustomOpen(value === 'custom'); void selectProfile(value)}} disabled={applying} statusMessage={status} />
              {customOpen || config.mainConfig === 'custom' ? <PluginControl /> : null}
              {!customOpen && config.mainConfig === 'v2' ? <V2SubOptions subs={config.v2Subs} onSelect={selectV2} disabled={applying} /> : null}
              {!customOpen && (config.mainConfig === 'v1' || config.mainConfig === 'aiwv2') ? <LegacyProfileControl profile={config.mainConfig} disabled={applying} /> : null}
              {!customOpen && config.mainConfig === 'aiwv5' ? <V5Control disabled={applying} /> : null}
              {!customOpen && config.mainConfig === 'none' ? <Box py="10" textAlign="center" borderTop="1px solid rgba(255,255,255,.055)"><Icon as={FiVolume2} boxSize="7" color="whiteAlpha.200" /><Text mt="2" color="whiteAlpha.350" fontSize="sm">{t('status.processingDisabled')}</Text></Box> : null}
              {!customOpen && config.mainConfig === 'v2' ? <Box py="5" textAlign="center" borderTop="1px solid rgba(255,255,255,.055)"><Icon as={LuWaves} boxSize="6" color="whiteAlpha.200" /><Text mt="2" color="whiteAlpha.350" fontSize="sm">{t('status.atV2Routed')}</Text></Box> : null}
            </VStack> : null}
            {!loading && exists && section === 'autoeq' ? <AutoEqLibrary /> : null}
            {section==='diagnostics'?<Diagnostics/>:null}
          </Box>
        </Box>

        <Flex data-cosmic={config.mainConfig==='custom'} className="audio-statusbar" h="104px" flexShrink="0" overflowX="auto" overflowY="hidden" align="center" px="6" gap="5" bg="#09070c" borderTop="1px solid rgba(255,255,255,.07)">
          <Flex w="4px" h="52px" borderRadius="4px" bg="#9b4dff" boxShadow="0 0 16px rgba(155,77,255,.5)" />
          <Box minW="180px"><Text color="whiteAlpha.350" fontSize="9px" fontWeight="700" letterSpacing="wide">{t('footer.activeProfile')}</Text><Text mt="1" fontSize="sm" fontWeight="800">{displayProfile}</Text><Text color="green.300" fontSize="10px">{t(config.mainConfig==='none'?'common.off':'common.active')}</Text></Box>
          <Box h="42px" w="1px" bg="rgba(255,255,255,.07)" />
          {config.mainConfig==='custom'?<><CosmicAudioStatus/></>:<>
          <Box flex="1" minW="160px"><Text color="whiteAlpha.350" fontSize="9px" fontWeight="700" letterSpacing="wide">{t('footer.headphoneEq')}</Text><Text mt="1" fontSize="sm" fontWeight="700" truncate>{activeEqName}</Text><Text color="purple.200" fontSize="10px" fontWeight="650" truncate>{activeEqSource}</Text></Box>
          {config.mainConfig !== 'none' ? <ChannelConfigControl compact disabled={applying} fixed16ch={config.mainConfig === 'aiwv5'} /> : null}
          <Box minW="170px"><Text color="whiteAlpha.350" fontSize="9px" fontWeight="700">{t('footer.gameVersionChannels')}</Text><Text mt="1" fontSize="sm" fontWeight="700">{routeSummary}</Text><Text color="whiteAlpha.350" fontSize="10px">{routeDetail}</Text></Box>

          </>}
          <Box className="audio-tuned-device" minW="190px" p="3" borderRadius="9px" bg="#100d13" border="1px solid rgba(255,255,255,.065)"><Text color="whiteAlpha.350" fontSize="9px" fontWeight="700">{t('footer.tunedDevice')}</Text><Flex mt="1" align="center" justify="space-between"><Box><Text fontSize="sm" fontWeight="750">{tunedDevice}</Text><Text color="whiteAlpha.350" fontSize="10px">{tunedDeviceDetail}</Text></Box><Text color={config.mainConfig === 'none' ? 'whiteAlpha.300' : 'green.300'} fontSize="10px" fontWeight="700">{config.mainConfig === 'none' ? t('common.off').toUpperCase() : t(exists?'status.configurationDetected':'status.installationRequired')}</Text></Flex></Box>
        </Flex>
      </Flex>
    </Flex>
  </AudioAccessGate></Box>
}
