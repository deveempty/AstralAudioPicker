import {createContext,useContext,useState} from 'react'
import {FiLogOut,FiUser} from 'react-icons/fi'
import type {AudioAccessStatus} from '../../shared/audio-access'
import {useI18n} from '../i18n'
export const AudioAccountContext=createContext<{state:AudioAccessStatus;busy:boolean;logout:()=>void}|null>(null)
export default function AccountSidebar(){
 const account=useContext(AudioAccountContext),[open,setOpen]=useState(false),[failedAvatar,setFailedAvatar]=useState<string|null>(null),{t}=useI18n()
 if(!account)return null
 const {state,busy,logout}=account
 const name=state.username??t('audioAccess.localTest')
 return <div className="audio-account-footer">
  {open?<div className="audio-account-menu" id="audio-account-menu"><strong>{name}</strong><span>{t(state.localTest?'audioAccess.localTest':'account.connected')}</span>{!state.localTest?<button type="button" disabled={busy} onClick={logout}><FiLogOut/>{t('audioAccess.logout')}</button>:null}</div>:null}
  <button type="button" className="audio-account-trigger" aria-expanded={open} aria-controls="audio-account-menu" onClick={()=>setOpen(!open)}>
   <span className="audio-account-avatar" aria-hidden="true">{state.avatarUrl&&failedAvatar!==state.avatarUrl?<img src={state.avatarUrl} alt="" referrerPolicy="no-referrer" onError={()=>setFailedAvatar(state.avatarUrl??null)}/>:state.username?state.username.slice(0,2).toUpperCase():<FiUser/>}</span>
   <span className="audio-account-identity"><strong>{name}</strong><small>{state.localTest?t('audioAccess.localTest'):'Astral Audio \u00b7 Discord'}</small></span>
   <span className="audio-account-view">{t(open?'account.hide':'account.view')}</span>
  </button>
 </div>
}
