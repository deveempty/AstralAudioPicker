import {readApoInventory} from './apo-inventory'
import {apoIds,fxSlot,enhancementFlag,endpointActive,selectApoEndpoint,type CableKind,type RegistryValues} from './apo-repair-plan'
export interface ApoChain {deviceId:string;active:boolean;pre:boolean;post:boolean;originalPre:boolean;originalPost:boolean;disabled:boolean}
export async function readApoChain(kind:CableKind='v5'):Promise<ApoChain>{
 const inventory=await readApoInventory(),endpoint=selectApoEndpoint(inventory,kind)
 const value=(values:RegistryValues|null,key:string)=>values?.[key]?.kind==='String'?String(values[key].value):''
 const currentPre=value(endpoint.fx,fxSlot(1)),currentPost=value(endpoint.fx,fxSlot(2))
 let originalPre=value(endpoint.child,fxSlot(1)),originalPost=value(endpoint.child,fxSlot(2))
 if(originalPre==='!VALUE'&&originalPost==='!VALUE'){originalPre=value(endpoint.child,fxSlot(5));originalPost=value(endpoint.child,fxSlot(6))}
 const childPre=value(endpoint.child,'PreMixChild'),childPost=value(endpoint.child,'PostMixChild')
 const original=(child:string,expected:string)=>!!child&&child.toLowerCase()===expected.toLowerCase()&&!!inventory.dlls[child.toLowerCase()]&&!/EqualizerAPO\.dll$/i.test(inventory.dlls[child.toLowerCase()])
 const modern=[5,6,7,13,14,15].some(slot=>!!endpoint.fx?.[fxSlot(slot)])
 return {deviceId:endpoint.id,active:endpointActive(endpoint.state),
  pre:inventory.registered&&!modern&&currentPre.toLowerCase()===apoIds.pre.toLowerCase(),post:inventory.registered&&!modern&&currentPost.toLowerCase()===apoIds.post.toLowerCase(),
  originalPre:original(childPre,originalPre),originalPost:original(childPost,originalPost),disabled:endpoint.fx?.[enhancementFlag]?.value===1}
}
export function verifyApoChain(chain:ApoChain){
 // Registration readback is not a measurement of the running DSP.
 if(!chain.pre||!chain.post||!chain.originalPre||!chain.originalPost)throw Error('APO_CHAIN_UNCONFIRMED')
}
