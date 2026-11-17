import {useEffect,useRef,useState,type ReactNode} from 'react'
import {Box,Flex,Text} from '@chakra-ui/react'
import {FiChevronDown} from 'react-icons/fi'
import type {VmChannel,VmCommand,VmState} from '../../shared/voicemeeter'
import {vmDrivers,vmSettingValues,type VmSettings,type VmSetting,type VmDevice} from '../../shared/voicemeeter'
import {useI18n} from '../i18n'
import AstralButton from './ui/AstralButton'
import AstralSelect from './ui/AstralSelect'
export const vmAutoKey='astral-audio.voicemeeter-autostart.v1'

export function Volume({channel,disabled,onGain,onMute,compact=false}:{compact?:boolean;channel:VmChannel;disabled:boolean;onGain:(v:number)=>void;onMute:()=>void}){
 const {t}=useI18n(),[value,setValue]=useState(channel.gain),editing=useRef(false)
 useEffect(()=>{if(!editing.current)setValue(channel.gain)},[channel.gain])
 const commit=()=>{if(editing.current){editing.current=false;onGain(value)}}
 return <Box mt={compact?"2":"5"}><Flex justify="space-between"><Text fontSize={compact?"10px":"sm"}>{t('vm.gain')}</Text><Text fontSize={compact?"10px":"sm"}>{value>0?'+':''}{value.toFixed(1)} dB</Text></Flex>
  <input aria-label={t('vm.gain')} type="range" min={-60} max={12} step={0.5} value={value} disabled={disabled} style={{width:'100%',accentColor:'#a78bfa',margin:'12px 0'}} onChange={e=>{editing.current=true;setValue(Number(e.target.value))}} onPointerUp={commit} onKeyUp={commit} onBlur={commit}/>
  <Flex align="center" justify="space-between"><AstralButton size="sm" variant={channel.mute?'primary':'secondary'} aria-pressed={channel.mute} disabled={disabled} onClick={onMute}>{t('vm.mute')}</AstralButton>{!compact?<Text fontSize="xs" color="whiteAlpha.600">{t('vm.peak')}: {channel.peakDb} dBFS</Text>:null}</Flex></Box>
}
function EngineSettings({settings,disabled,onApply,onShow,onRestart,children}:{children:ReactNode;settings:VmSettings;disabled:boolean;onApply:(values:VmSettings)=>Promise<boolean>;onShow:()=>void;onRestart:()=>void}){
 const {t}=useI18n(),[draft,setDraft]=useState<VmSettings>({})
 return <Box as="details" mt="6" bg="#08090c" border="1px solid #202127" borderRadius="11px" css={{'&[open] .engine-chevron':{transform:'rotate(180deg)'}}}>
  <Box as="summary" p="5" display="flex" alignItems="center" justifyContent="space-between" cursor="pointer" listStyleType="none" borderRadius="11px" _hover={{bg:'whiteAlpha.50'}} _focusVisible={{outline:'2px solid #a78bfa',outlineOffset:'2px'}} css={{'&::-webkit-details-marker':{display:'none'}}}>
   <Text fontWeight="700">{t('vm.settings')}</Text><Box className="engine-chevron" color="whiteAlpha.600"><FiChevronDown aria-hidden="true"/></Box>
  </Box>
  <Box px="5" pb="5"><Text fontSize="sm" color="whiteAlpha.600">{t('vm.settingsNote')}</Text>
  <Flex gap="4" wrap="wrap" mt="4">{(Object.keys(vmSettingValues) as VmSetting[]).map(key=>{
   const value=draft[key]??settings[key],allowed=vmSettingValues[key],values=value!==undefined&&!allowed.includes(value)?[value,...allowed]:allowed
   const label=key==='sr'?t('vm.sampleRate'):`${t('vm.buffer')} ${key.toUpperCase()}`
   return <Box key={key} flex="1" minW="180px"><Text fontSize="sm" mb="2">{label}</Text><AstralSelect ariaLabel={label} disabled={disabled||settings[key]===undefined} value={value===undefined?'':String(value)} options={[...(value===undefined?[{value:'',label:t('vm.unavailable')}]:[]),...values.map(v=>({value:String(v),label:v===0?t('vm.default'):key==='sr'?`${v} Hz`:`${v} ${t('vm.samples')}`}))]} onChange={v=>setDraft(old=>({...old,[key]:Number(v)}))}/></Box>
  })}</Flex>
  <Flex mt="4" gap="3" wrap="wrap"><AstralButton disabled={disabled||!Object.keys(draft).length} onClick={async()=>{if(await onApply(draft))setDraft({})}}>{t('vm.applySettings')}</AstralButton><AstralButton variant="ghost" disabled={disabled||!Object.keys(draft).length} onClick={()=>setDraft({})}>{t('vm.discard')}</AstralButton></Flex>
  <Flex mt="4" gap="3" wrap="wrap"><AstralButton variant="ghost" disabled={disabled} onClick={onShow}>{t('vm.show')}</AstralButton><AstralButton variant="ghost" disabled={disabled} onClick={onRestart}>{t('vm.restart')}</AstralButton></Flex>
  <Text mt="3" fontSize="xs" color="whiteAlpha.500">{t('vm.clockNote')}</Text>
  {children}
  </Box>
 </Box>
}
export default function VoicemeeterControl(){
 const {t}=useI18n(),[state,setState]=useState<VmState|null>(null),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false)
 const [selection,setSelection]=useState({input1:'',input2:'',output:''}),dirty=useRef(false),pending=useRef(false),alive=useRef(true)
 const [startup,setStartup]=useState<{supported:boolean;enabled:boolean}|null>(null)
 useEffect(()=>{void window.electronAPI.audioStartupStatus().then(setStartup).catch(()=>{})},[])
 const [auto,setAuto]=useState(()=>{try{return localStorage.getItem(vmAutoKey)==='true'}catch{return false}})
 // The API reports names, not the active driver. Do not infer an ambiguous driver.
 const match=(devices:VmDevice[],name:string)=>{const found=devices.filter(d=>d.name===name);return found.length===1?found[0].key:name?'__unresolved__':''}
 const accept=(next:VmState)=>{if(!alive.current)return;setState(next);if(next.connected&&!dirty.current)setSelection({input1:match(next.inputs,next.strips[0]?.name),input2:match(next.inputs,next.strips[1]?.name),output:match(next.outputs,next.bus.name)})}
 const refresh=async()=>{if(pending.current)return;try{accept(await window.electronAPI.voicemeeterStatus())}catch{if(alive.current)setFailed(true)}}
 useEffect(()=>{alive.current=true;void refresh();const timer=setInterval(()=>void refresh(),1500);return()=>{alive.current=false;clearInterval(timer)}},[])
 const run=async(command:VmCommand):Promise<boolean>=>{if(pending.current)return false;pending.current=true;setBusy(true);setFailed(false);try{const next=await window.electronAPI.voicemeeterCommand(command);accept(next);if(next.error)setFailed(true);return !next.error}catch{if(alive.current)setFailed(true);return false}finally{pending.current=false;if(alive.current)setBusy(false)}}
 const choose=(key:keyof typeof selection,value:string)=>{dirty.current=true;setSelection(old=>({...old,[key]:value}))}
 const options=(input:boolean,optional=false,unresolved=false,currentName='')=>[...(unresolved?[{value:'__unresolved__',label:currentName,description:t('vm.currentDevice')}]:[]),...(!unresolved||optional?[{value:'',label:t(optional?'vm.none':'vm.choose')}]:[]),...(input?state?.inputs??[]:state?.outputs??[]).filter(d=>input||!/VB-Audio|Voicemeeter|CABLE/i.test(d.name)).sort((a,b)=>a.type-b.type||a.name.localeCompare(b.name)).map(d=>({value:d.key,label:`${vmDrivers[d.type]?.toUpperCase()??''}: ${d.name}`}))]
 return <Box>
  {!state?.connected?<Box mb="4"><AstralButton disabled={busy||!state?.installed} onClick={()=>void run({action:'connect'})}>{t('vm.connect')}</AstralButton></Box>:null}
  {!state?.installed&&state?<Text color="orange.200">{t('vm.missing')}</Text>:null}
  {!state?.connected?<Text color="whiteAlpha.500" fontSize="sm">{t('vm.startNote')}</Text>:null}
  <Flex gap="4" mt="5" wrap="wrap">{(['input1','input2','output'] as const).map((key,index)=>{
   const channel=index===2?state?.bus:state?.strips[index],target=index===2?'output':'input',slot=index===2?0:index
   return <Box key={key} flex="1" minW="240px" p="5" bg="#08090c" border="1px solid #202127" borderRadius="11px"><Text mb="3" fontWeight="700">{t(`vm.${key}`)}</Text><AstralSelect ariaLabel={t(`vm.${key}`)} value={selection[key]} options={options(index!==2,index===1,selection[key]==='__unresolved__',channel?.name??'')} disabled={busy||!state?.connected} onChange={value=>choose(key,value)}/>
    {channel?.name?<Text mt="2" fontSize="xs" color="whiteAlpha.600">{t('vm.currentDevice')}: {channel.name}</Text>:null}
    {channel?<Volume channel={channel} disabled={busy||!state?.connected} onGain={value=>void run({action:'gain',target,index:slot,value})} onMute={()=>void run({action:'mute',target,index:slot,value:channel.mute?0:1})}/>:null}</Box>
  })}</Flex>
  <Flex gap="3" mt="5" wrap="wrap"><AstralButton disabled={busy||!state?.connected||!selection.input1||!selection.output||Object.values(selection).includes('__unresolved__')} onClick={()=>void run({action:'route',...selection})}>{t('vm.apply')}</AstralButton></Flex>
  <EngineSettings settings={state?.settings??{}} disabled={busy||!state?.connected} onApply={values=>run({action:'settings',values})} onShow={()=>void run({action:'show'})} onRestart={()=>void run({action:'restart'})}>
  <Box display="grid" gridTemplateColumns={{base:'1fr',md:'1fr 1fr'}} gap="6" mt="5" pt="5" borderTop="1px solid #202127"><Box>
  <Box as="label" display="flex" gap="2" fontSize="sm" color="whiteAlpha.700"><input type="checkbox" disabled={busy||!startup?.supported} checked={startup?.enabled??false} onChange={async e=>{setBusy(true);setFailed(false);try{setStartup(await window.electronAPI.audioStartupSet(e.target.checked))}catch{setFailed(true)}finally{setBusy(false)}}}/>{t('vm.windowsStartup')}</Box>
  {startup&&!startup.supported?<Text fontSize="xs" mt="2" color="whiteAlpha.500">{t('vm.startupInstalled')}</Text>:null}
  </Box><Box>
  <Box as="label" display="flex" gap="2" fontSize="sm" color="whiteAlpha.700"><input type="checkbox" checked={auto} onChange={e=>{setAuto(e.target.checked);try{localStorage.setItem(vmAutoKey,String(e.target.checked))}catch{}}}/>{t('vm.auto')}</Box>
  <Text mt="2" fontSize="xs" color="whiteAlpha.500">{t('vm.background')}</Text>
  </Box></Box></EngineSettings>
  {failed?<Text role="alert" mt="3" color="red.300">{t('vm.failed')}</Text>:null}
 </Box>
}
