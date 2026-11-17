export interface VmDevice { key:string; name:string; type:number; hardwareId:string }
export interface VmChannel { name:string; gain:number; mute:boolean; peakDb:number }
export const vmDrivers:Record<number,string> = {1:'mme',3:'wdm',4:'ks',5:'asio'}
export const vmSettingValues = {
 sr:[44100,48000,88200,96000,176400,192000],
 mme:[128,256,512,1024,1536,2048], wdm:[128,256,512,1024,1536,2048], ks:[128,256,512,1024,1536,2048], asio:[0,128,256,512,1024,1536,2048],
}
export type VmSetting = keyof typeof vmSettingValues
export type VmSettings = Partial<Record<VmSetting,number>>
export interface VmState { installed:boolean; connected:boolean; edition:number; inputs:VmDevice[]; outputs:VmDevice[]; strips:VmChannel[]; bus:VmChannel; settings?:VmSettings; error?:string }
export type VmCommand = {action:'device';target:'input'|'output';key:string} | { action:'connect'|'show'|'hide'|'restart' } | {action:'settings';values:VmSettings} | { action:'route'; input1:string; input2:string; output:string } | { action:'gain'|'mute'; target:'input'|'output'; index:number; value:number }
export interface AudioStartupState {supported:boolean;enabled:boolean}
export interface VoicemeeterAPI { audioStartupStatus:()=>Promise<AudioStartupState>; audioStartupSet:(enabled:boolean)=>Promise<AudioStartupState>; voicemeeterStatus:()=>Promise<VmState>; voicemeeterCommand:(command:VmCommand)=>Promise<VmState> }
