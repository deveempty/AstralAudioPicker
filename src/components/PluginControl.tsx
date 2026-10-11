import {cosmicAudioStatus} from './cosmic-audio-status'
import { useEffect, useRef, useState } from 'react'
import { Box, Flex, Input, Slider, Switch, Text, VStack } from '@chakra-ui/react'
import AstralButton from './ui/AstralButton'
import AstralSelect from './ui/AstralSelect'
import StatusTag from './ui/StatusTag'
import { useI18n, type TranslationKey } from '../i18n'
import { builtinPluginProfiles, builtinPluginValues, samePluginValues, physicalValue, pluginParameters, type BuiltinPluginProfile, type SavedPluginProfile, type PluginLibraryResult, type PluginParameterId, type PluginProfile, type PluginResult, type PluginSnapshot } from '../../shared/plugin-control'
type Patch = Partial<Record<PluginParameterId, number>>
export default function PluginControl() {
 const { t } = useI18n()
 const [snapshot,setSnapshot]=useState<PluginSnapshot|null>(null)
 const [draft,setDraft]=useState<Patch>({})
 const [page,setPage]=useState(-1)
 const [error,setError]=useState<string|null>(null)
 const [saving,setSaving]=useState(false)
 const [library,setLibrary]=useState<SavedPluginProfile[]>([])
 const [selected,setSelected]=useState('')
 const [name,setName]=useState('')
 const [saveOpen,setSaveOpen]=useState(false)
 const [presetError,setPresetError]=useState<string|null>(null)
 const [notice,setNotice]=useState<'saved'|'loaded'|null>(null)
 const actionRunning=useRef(false),running=useRef(false),alive=useRef(true)
 const queued=useRef<Patch>({}),timer=useRef<ReturnType<typeof setTimeout>>()
 const apply=(result: PluginResult)=>{if(!alive.current)return;if(result.success){setSnapshot(old=>!old||result.snapshot.state.revision>=old.state.revision?result.snapshot:old);setError(null)}else setError(result.code)}
 const acceptLibrary=(result: PluginLibraryResult)=>{if(!alive.current)return;if(result.success){setLibrary(result.profiles);if(result.savedId)setSelected(result.savedId)}else setPresetError(result.code)}
 const flush=async()=>{
  if(running.current||!Object.keys(queued.current).length)return
  running.current=true;setSaving(true);const patch=queued.current;queued.current={}
  try{const result=await window.electronAPI.patchPluginControl(patch)
   if(!result.success&&result.code==='busy'){queued.current={...patch,...queued.current};timer.current=setTimeout(()=>void flush(),150)}
   else{apply(result);if(alive.current)setDraft(old=>{const next={...old};for(const id of Object.keys(patch) as PluginParameterId[])if(next[id]===patch[id])delete next[id];return next})}
  }catch{if(alive.current){setError('storage');setDraft({})}}
  finally{running.current=false;if(alive.current)setSaving(false);if(alive.current&&Object.keys(queued.current).length)timer.current=setTimeout(()=>void flush(),150)}
 }
 const change=(id: PluginParameterId,value: number)=>{if(actionRunning.current)return;setNotice(null);setDraft(old=>({...old,[id]:value}));queued.current[id]=value;clearTimeout(timer.current);timer.current=setTimeout(()=>void flush(),100)}
 useEffect(()=>{
  alive.current=true;let polling=false,listing=false
  const refresh=async()=>{if(polling)return;polling=true;try{apply(await window.electronAPI.getPluginControl())}catch{if(alive.current)setError('storage')}finally{polling=false}}
  const refreshLibrary=async()=>{if(listing)return;listing=true;try{acceptLibrary(await window.electronAPI.listPluginPresets())}catch{if(alive.current)setPresetError('storage')}finally{listing=false}}
  void refresh();void refreshLibrary();const poll=setInterval(()=>void refresh(),600),libraryPoll=setInterval(()=>void refreshLibrary(),1500)
  return()=>{alive.current=false;clearInterval(poll);clearInterval(libraryPoll);clearTimeout(timer.current);if(Object.keys(queued.current).length)void window.electronAPI.patchPluginControl(queued.current)}
 },[])
 const action=async(task:()=>Promise<void>)=>{if(actionRunning.current||running.current||Object.keys(queued.current).length)return;actionRunning.current=true;setSaving(true);setPresetError(null);setNotice(null);try{await task()}catch{setPresetError('storage')}finally{actionRunning.current=false;if(alive.current)setSaving(false)}}
 const select=(profile:PluginProfile)=>action(async()=>{apply(await window.electronAPI.selectPluginProfile(profile))})
 const builtin=(id:BuiltinPluginProfile)=>action(async()=>{const result=await window.electronAPI.applyBuiltinPluginPreset(id);apply(result);if(result.success){setSelected('');setNotice('loaded')}})
 const save=(saveName=name.trim())=>action(async()=>{if(!snapshot)return;const result=await window.electronAPI.savePluginPreset(saveName,snapshot.state.revision);acceptLibrary(result);if(result.success){setNotice('saved');setSaveOpen(false)}})
 const load=()=>action(async()=>{const result=await window.electronAPI.loadPluginPreset(selected);apply(result);if(result.success)setNotice('loaded');else setPresetError(result.code)})
 if(!snapshot)return <Text role="status" color={error?'red.300':'whiteAlpha.500'}>{t(error?'plugin.error.storage':'plugin.loading')}</Text>
 const {state}=snapshot
 const {moduleMissing,synced,statusKey}=cosmicAudioStatus(snapshot)
 const dirty=saving||Object.keys(draft).length>0
 const currentBuiltin=builtinPluginProfiles.find(id=>samePluginValues(builtinPluginValues(id),state.values))
 const currentSaved=library.find(p=>samePluginValues(p.values,state.values))
 const currentName=currentSaved?.name??(currentBuiltin?t(('plugin.builtin.'+currentBuiltin) as TranslationKey):t(state.profile==='standard'?'plugin.standard':'plugin.custom'))
 const existingName=library.some(p=>p.name.toLowerCase()===name.trim().toLowerCase())
 return <VStack className="cosmic-workspace" align="stretch" gap="3">
  <Box className="cosmic-preset-panel" p="4" borderRadius="10px" bg="#101012" border="1px solid rgba(155,77,255,.22)">
   <Flex className="cosmic-save-heading" direction="column" align="stretch"><Box><Text title={currentName} fontWeight="600" truncate>{currentName}</Text></Box><StatusTag tone={moduleMissing?'orange':synced?'green':'neutral'}>{t((dirty?'plugin.saving':statusKey) as TranslationKey)}</StatusTag></Flex>
   <details className="cosmic-bases"><summary>{t('design.chooseBase')}<span>{t('design.basesCount')}</span></summary><div className="cosmic-base-grid">{builtinPluginProfiles.map(id=><button type="button" className="cosmic-base" key={id} aria-pressed={currentBuiltin===id} disabled={dirty} onClick={()=>void builtin(id)}><strong>{t(('plugin.builtin.'+id) as TranslationKey)}</strong><span>{t(('plugin.builtinHelp.'+id) as TranslationKey)}</span></button>)}</div></details>

   <Text mt="2" fontSize="xs" color="whiteAlpha.700">{t('cosmic.experiment')}</Text>
   <Flex mt="3" gap="2" align="center" flexWrap="wrap">
    <Box flex="1" minW="180px"><AstralSelect ariaLabel={t('plugin.savedSelect')} placeholder={t('plugin.savedSelect')} value={selected} disabled={dirty} options={library.map(p=>({value:p.id,label:p.name}))} onChange={id=>{setSelected(id);setNotice(null)}} /></Box>
    <AstralButton disabled={dirty||!library.some(p=>p.id===selected)} variant="secondary" onClick={()=>void load()}>{t('plugin.load')}</AstralButton>
    <AstralButton variant="secondary" disabled={dirty} onClick={()=>{setName('');setSaveOpen(v=>!v)}}>{t('cosmic.saveAs')}</AstralButton>
    <AstralButton disabled={dirty||!selected||!library.some(p=>p.id===selected)} variant="ghost" onClick={()=>{const target=library.find(p=>p.id===selected);if(target)void save(target.name)}}>{t('plugin.updatePreset')}</AstralButton>
   </Flex>
   {selected?<Text mt="2" fontSize="xs" color="whiteAlpha.700">{t('cosmic.updateTarget',{name:library.find(p=>p.id===selected)?.name??''})}</Text>:null}
   {saveOpen?<Box mt="3" p="3" bg="whiteAlpha.50" borderRadius="8px">
    <label htmlFor="cosmic-preset-name">{t('plugin.presetName')}</label>
    <Flex mt="2" gap="2" align="center" flexWrap="wrap"><Input id="cosmic-preset-name" autoFocus h="42px" px="3" flex="1" minW="180px" bg="#100d13" color="white" border="1px solid rgba(255,255,255,.22)" borderRadius="8px" _focusVisible={{borderColor:'purple.400',outline:'2px solid rgba(155,77,255,.25)',outlineOffset:'2px'}} aria-label={t('plugin.presetName')} placeholder={t('cosmic.nameExample')} value={name} maxLength={64} disabled={saving} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')setSaveOpen(false);if(e.key==='Enter'&&!dirty&&name.trim()&&!existingName){e.preventDefault();void save()}}}/><AstralButton disabled={dirty||!name.trim()||existingName} onClick={()=>void save()}>{t('plugin.savePreset')}</AstralButton><AstralButton variant="ghost" onClick={()=>setSaveOpen(false)}>{t('cosmic.cancel')}</AstralButton></Flex>
    <Text mt="2" fontSize="xs" color={existingName?'orange.300':'whiteAlpha.700'}>{t(existingName?'cosmic.duplicateName':'cosmic.saveHelp')}</Text>
   </Box>:null}
   <Text minH="24px" mt="2" role="status" fontSize="sm" color="purple.200">{notice?t(('plugin.'+notice) as TranslationKey):'\u00a0'}</Text>
   <Flex className="cosmic-recovery-actions" mt="3" pt="3" borderTop="1px solid rgba(255,255,255,.08)" gap="2" direction="column" align="stretch">
    <AstralButton fullWidth variant="ghost" disabled={dirty} onClick={()=>void select('standard')}>{t('plugin.restoreStandard')}</AstralButton>
    <AstralButton fullWidth variant="ghost" disabled={dirty||!snapshot.hasCustom||state.profile==='custom'} onClick={()=>void select('custom')}>{t('plugin.restoreCustom')}</AstralButton>
   </Flex>
   {presetError?<Text mt="2" role="alert" fontSize="sm" color="red.300">{t(('plugin.error.'+presetError) as TranslationKey)}</Text>:null}
  </Box>
    {error?<Text role="alert" color="red.300">{t(('plugin.error.'+error) as TranslationKey)}</Text>:null}
    <Flex className="cosmic-tabs" gap="2" flexWrap="wrap" role="tablist" aria-label={t('plugin.sections')}><AstralButton role="tab" aria-selected={page===-1} size="sm" variant={page===-1?'primary':'ghost'} onClick={()=>setPage(-1)}>{t('cosmic.quick')}</AstralButton>{Array.from({ length: 7 }, (_, i) => <AstralButton key={i} role="tab" aria-selected={page === i} size="sm" variant={page === i ? 'primary' : 'ghost'} onClick={() => setPage(i)}>{t(`plugin.page.${i}` as TranslationKey)}</AstralButton>)}</Flex>
    <Text fontSize="xs" color="whiteAlpha.600">{t('cosmic.resetSlider')}</Text>
    <VStack role="tabpanel" aria-label={page===-1?t('cosmic.quick'):t(`plugin.page.${page}` as TranslationKey)} align="stretch" gap="3" display="grid" gridTemplateColumns={{base:'1fr',lg:'repeat(2,minmax(0,1fr))'}}>
      {(page===-1?[5,9,32,19,25,38].map(i=>pluginParameters[i]):pluginParameters.filter(p => p.page === page && p.index !== 24)).map(parameter => {
        const value = draft[parameter.id] ?? state.values[parameter.index]
        const physical = physicalValue(parameter.index, value)
        const label = t(`plugin.param.${parameter.id}` as TranslationKey)
        const isToggle = parameter.toggle || parameter.index===29
        const formatted = isToggle ? t(value >= .5 ? 'common.on' : 'common.off') : `${physical.toFixed(parameter.unit === 'Hz' || parameter.unit === '%' ? 0 : 1)} ${parameter.unit}`
        const prerequisite=parameter.index<30&&state.values[30]<.5?30:parameter.index>=32&&parameter.index<=35&&state.values[31]<.5?31:parameter.index>=37&&parameter.index<=42&&state.values[36]<.5?36:parameter.index>=44&&state.values[43]<.5?43:[13,14,15,16,17,18,19,20,26,28].includes(parameter.index)&&state.values[1]<.5?1:null
        return <Box className="cosmic-control" key={parameter.id} p="5" bg="#100d13" borderRadius="10px" border="1px solid rgba(255,255,255,.07)">
          <Flex justify="space-between" align="center" gap="4"><Text id={`plugin-label-${parameter.id}`} fontSize="sm" fontWeight="650">{label}</Text><Text className="cosmic-value" fontSize="sm" color="purple.200" fontWeight="600" aria-live="off">{formatted}</Text>{isToggle ? <Switch.Root disabled={actionRunning.current} size="sm" colorPalette="purple" checked={value >= .5} onCheckedChange={e => change(parameter.id, e.checked ? 1 : 0)}><Switch.HiddenInput aria-label={label} /><Switch.Control><Switch.Thumb /></Switch.Control></Switch.Root> : null}</Flex>
          <Text id={`cosmic-help-${parameter.id}`} mt="2" fontSize="xs" lineHeight="1.6" color="whiteAlpha.800">{t((`cosmic.help.${parameter.id}`) as TranslationKey)}</Text>
          {prerequisite!==null?<Text mt="1" fontSize="xs" color="orange.300">{t('cosmic.requires',{name:t((`plugin.param.${pluginParameters[prerequisite].id}`) as TranslationKey)})}</Text>:null}
          {!isToggle ? <Slider.Root title={t('cosmic.resetSlider')} onDoubleClick={() => { change(parameter.id, Math.fround(parameter.initial)); clearTimeout(timer.current); void flush() }} disabled={actionRunning.current} mt="3" min={0} max={1} step={.001} value={[value]} onValueChange={e => change(parameter.id, e.value[0])} onValueChangeEnd={() => { clearTimeout(timer.current); void flush() }}><Slider.Control><Slider.Track h="1.5" bg="whiteAlpha.200" borderRadius="full"><Slider.Range bg="purple.500" /></Slider.Track><Slider.Thumb index={0} boxSize="4" bg="purple.300" borderColor="purple.500" aria-label={label} aria-valuetext={formatted} aria-describedby={`cosmic-help-${parameter.id}`}><Slider.HiddenInput /></Slider.Thumb></Slider.Control></Slider.Root> : null}
        </Box>
      })}
    </VStack>

  </VStack>
}
