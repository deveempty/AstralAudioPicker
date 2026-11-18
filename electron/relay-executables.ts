import fs from 'node:fs'
import path from 'node:path'

// One entry per edition, even when both architectures are installed. Preserve
// the existing executable preference and support installations with only x64.
export function relayExecutables(folder:string){
 return ['voicemeeter','voicemeeterpro','voicemeeter8'].flatMap((name,index)=>{
  const executable=[`${name}.exe`,`${name}_x64.exe`].map(file=>path.join(folder,file)).find(file=>{
   try{return fs.statSync(file).isFile()}catch{return false}
  })
  return executable?[{edition:index+1,path:executable}]:[]
 })
}
