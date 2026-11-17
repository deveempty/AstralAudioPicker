// Equalizer APO's published endpoint registration contract (installation version 2).
// Original effect IDs are recovered from each endpoint, never from another PC.
export const apoIds={pre:'{EACD2258-FCAC-4FF4-B36D-419E924A6D79}',post:'{EC1CC9CE-FAED-4822-828A-82A81A6F018F}'} as const
export const fxSlot=(slot:number)=>`{d04e05a6-594b-4fb6-a80d-01af5eed7d1d},${slot}`
export const enhancementFlag='{1da5d803-d492-4edd-8c23-e0c0ffee7f0e},5'
export type RegistryValue={kind:string;value:string|number|string[]|number[]}
export type RegistryValues=Record<string,RegistryValue>
export type CableKind='legacy'|'v5'
export const cableNames:Record<CableKind,string>={legacy:'Cable Input 7.1',v5:'CABLE In 16ch'}
export const endpointActive=(state:number)=>(state&15)===1&&(state&0x10000000)===0
export interface ApoEndpointState {id:string;name:string;adapter:string;state:number;fx:RegistryValues|null;child:RegistryValues|null}
export interface ApoInventory {endpoints:ApoEndpointState[];dlls:Record<string,string>;registered:boolean}
export interface ApoPatch {id:string;name:string;state:number;beforeFx:RegistryValues;beforeChild:RegistryValues|null;fx:Record<string,RegistryValue|null>;child:Record<string,RegistryValue|null>}
const str=(value:string):RegistryValue=>({kind:'String',value})
const own=(value:unknown)=>typeof value==='string'&&Object.values(apoIds).some(id=>id.toLowerCase()===value.toLowerCase())
const absent=(value:unknown)=>value===undefined||value===''||value==='!VALUE'||value==='!KEY'
const scalar=(values:RegistryValues|null,key:string)=>values?.[key]?.kind==='String'?values[key].value:undefined
const same=(a:RegistryValue|undefined,b:RegistryValue|null)=>b===null?a===undefined:!!a&&a.kind===b.kind&&JSON.stringify(a.value)===JSON.stringify(b.value)
function fail(code:string,endpoint?:ApoEndpointState):never{throw new Error(code,{cause:{endpoint:endpoint?.name,deviceId:endpoint?.id}})}
export function selectApoEndpoint(inventory:ApoInventory,kind:CableKind){
 const candidates=inventory.endpoints.filter(e=>e.name.toLowerCase()===cableNames[kind].toLowerCase()&&e.adapter==='VB-Audio Virtual Cable'&&[1,2,8].includes(e.state&15))
 const active=candidates.filter(e=>endpointActive(e.state)),matches=active.length===1?active:candidates
 if(matches.length!==1)fail('APO_ENDPOINT_UNAVAILABLE')
 if(!/^\{[0-9a-f-]{36}\}$/i.test(matches[0].id))fail('APO_ENDPOINT_UNAVAILABLE')
 return matches[0]
}
export function planApoRepair(inventory:ApoInventory):ApoPatch[]{
 if(!inventory.registered)fail('APO_COMPONENT_UNAVAILABLE')
 // Resolve both devices before any writes, including the inactive profile cable.
 return (['legacy','v5'] as const).flatMap(kind=>{
  const e=selectApoEndpoint(inventory,kind),fx=e.fx
  if(!fx)fail('APO_ORIGINAL_EFFECTS_UNKNOWN',e)
  if(e.child&&scalar(e.child,'Version')!=='2')fail('APO_ORIGINAL_EFFECTS_UNKNOWN',e)
  for(const slot of [13,14,15])if(fx[fxSlot(slot)]&&!absent(fx[fxSlot(slot)].value))fail('APO_ORIGINAL_EFFECTS_UNKNOWN',e)
  const original:Record<number,string>={}
  for(const slot of [1,2,5,6,7]){
   const key=fxSlot(slot),current=scalar(fx,key),saved=scalar(e.child,key)
   if(fx[key]&&current===undefined)fail('APO_ORIGINAL_EFFECTS_UNKNOWN',e)
   // A previous conversion removes the modern slots; retain their uninstall backup.
   const candidate=own(current)||current===undefined&&e.child?saved:current
   if(own(candidate)||own(current)&&candidate===undefined)fail('APO_ORIGINAL_EFFECTS_UNKNOWN',e)
   if(!absent(candidate)&&(typeof candidate!=='string'||!inventory.dlls[candidate.toLowerCase()]||/EqualizerAPO\.dll$/i.test(inventory.dlls[candidate.toLowerCase()])))fail('APO_ORIGINAL_EFFECTS_UNKNOWN',e)
   original[slot]=absent(candidate)?'!VALUE':candidate as string
  }
  const modernFallback=absent(original[1])&&absent(original[2])
  const pre=modernFallback?original[5]:original[1],post=modernFallback?original[6]:original[2]
  // VB-Cable must expose its native effects; without them LEQ cannot be restored safely.
  if(absent(pre)||absent(post))fail('APO_ORIGINAL_EFFECTS_UNKNOWN',e)
  // Do not discard an additional independent EFX or a different modern processor.
  if(!absent(original[7])||(!absent(original[5])&&original[5].toLowerCase()!==pre.toLowerCase())||(!absent(original[6])&&original[6].toLowerCase()!==post.toLowerCase()))fail('APO_ORIGINAL_EFFECTS_UNKNOWN',e)
  const desiredFx:Record<string,RegistryValue|null>={[fxSlot(1)]:str(apoIds.pre),[fxSlot(2)]:str(apoIds.post),[fxSlot(5)]:null,[fxSlot(6)]:null,[fxSlot(7)]:null,[enhancementFlag]:{kind:'DWord',value:0}}
  const desiredChild:Record<string,RegistryValue|null>={Version:str('2'),PreMixChild:str(pre),PostMixChild:str(post)}
  for(const slot of [1,2,5,6,7])desiredChild[fxSlot(slot)]=str(original[slot])
  if(!e.child?.AllowSilentBufferModification)desiredChild.AllowSilentBufferModification=str('false')
  const patchFx=Object.fromEntries(Object.entries(desiredFx).filter(([key,value])=>!same(fx[key],value)))
  const patchChild=Object.fromEntries(Object.entries(desiredChild).filter(([key,value])=>!same(e.child?.[key],value)))
  return Object.keys(patchFx).length||Object.keys(patchChild).length?[{id:e.id,name:e.name,state:e.state,beforeFx:fx,beforeChild:e.child,fx:patchFx,child:patchChild}]:[]
 })
}
