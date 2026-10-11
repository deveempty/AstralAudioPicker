export const CUSTOM_OUTPUT_DLL = 'C:\\ProgramData\\AstralAudio\\Control\\Cosmic.dll'
const begin = '# BEGIN ASTRAL CUSTOM OUTPUT'
const end = '# END ASTRAL CUSTOM OUTPUT'
const muted = '# ASTRAL CUSTOM MUTED: '
export function customOutputActive(content:string):boolean {return /^\s*VSTPlugin:.*Cosmic\.dll(?:\s+ChunkData\s+"[^"\r\n]*")?\s*$/im.test(content)}
export function cosmicChain(dll=CUSTOM_OUTPUT_DLL):string[]{return ['# Cosmic: VB Cable 16ch','Device: CABLE In 16ch','Channel: ALL','# 16ch TUNE','Preamp: -6 dB','Filter: ON HPQ Fc 40 Hz Q 0.707','VSTPlugin: Library '+dll,'Filter: ON PK Fc 6800 Hz Gain 1.5 dB Q 1.5']}
export function routeCustomOutput(content:string,active:boolean):string {
 const bom=content.startsWith('\uFEFF')?'\uFEFF':'';content=content.replace(/^\uFEFF/,'')
 const newline=content.includes('\r\n')?'\r\n':'\n'
 const lines=content.split(/\r?\n/),restored:string[]=[];let inside=false,blocks=0
 // Read old versions, but never write their markers again.
 for(const line of lines){if(line.trim()===begin){if(inside||++blocks>1)throw Error('AMBIGUOUS_RECONCILIATION');inside=true;continue}if(line.trim()===end){if(!inside)throw Error('AMBIGUOUS_RECONCILIATION');inside=false;continue}if(!inside)restored.push(line.startsWith(muted)?'# '+line.slice(muted.length):line)}
 if(inside)throw Error('AMBIGUOUS_RECONCILIATION')
 const canonical=(line:string)=>line.replace(/^(?:\s*#\s*)+/,'').trim().replace(/\s+ChunkData\s+"[^"\r\n]*"\s*$/i,'')
 const expected=cosmicChain().map(canonical),body:string[]=[]
 for(let i=0;i<restored.length;i++){
  if(canonical(restored[i])===expected[0]){
   if(!expected.every((line,n)=>canonical(restored[i+n]??'')===line))throw Error('AMBIGUOUS_RECONCILIATION')
   i+=7
   // Remove the obsolete scope reset only when attached to our recognized block.
   if(canonical(restored[i+1]??'').toLowerCase()==='device: all'&&canonical(restored[i+2]??'')==='Channel: ALL')i+=2
   continue
  }
  if(expected.slice(4).every((line,n)=>canonical(restored[i+n]??'')===line)){i+=3;continue}
  let line=restored[i]
  if(active){const value=line.trim();const include=/^Include:\s*.*(?:at_v[123]|aiw_v3|BO7[\\/]V5|data[\\/]eq[\\/]v5|boost)/i.test(value);const engine=/^VSTPlugin:.*(?:Lirio EQ|AstralCustom|Cosmic)/i.test(value);if(include||engine)line='# '+line}
  body.push(line)
 }
 while(body.length&&!body[0].trim())body.shift()
 const chain=cosmicChain().map(line=>active?line:'# '+line)
 return bom+chain.join(newline)+newline+newline+body.join(newline)
}
