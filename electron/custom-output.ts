import path from 'node:path'
export const CUSTOM_OUTPUT_DLL = 'C:\\ProgramData\\AstralAudio\\Control\\Cosmic.dll'
const begin = '# BEGIN ASTRAL CUSTOM OUTPUT'
const end = '# END ASTRAL CUSTOM OUTPUT'
const muted = '# ASTRAL CUSTOM MUTED: '
export function customOutputActive(content:string):boolean {const section=content.split(begin)[1]?.split(end)[0];return section!==undefined?/^VSTPlugin:/m.test(section):/^VSTPlugin:.*Cosmic\.dll\s*$/im.test(content)}
export function cosmicChain(dll=CUSTOM_OUTPUT_DLL):string[]{return ['# Cosmic: VB Cable 16ch','Device: CABLE In 16ch','Channel: ALL','# 16ch TUNE','Preamp: -6 dB','Filter: ON HPQ Fc 40 Hz Q 0.707','VSTPlugin: Library '+dll,'Filter: ON PK Fc 6800 Hz Gain 1.5 dB Q 1.5','Device: all','Channel: ALL']}
export function routeCustomOutput(content:string,active:boolean):string {
 const bom=content.startsWith('\uFEFF')?'\uFEFF':'';content=content.replace(/^\uFEFF/,'')
 // Migrate the exact previously installed unmarked four-line Cosmic chain.
 if(!content.includes(begin))content=content.replace(/^Preamp: -6 dB\r?\nFilter: ON HPQ Fc 40 Hz Q 0\.707\r?\nVSTPlugin: Library [^\r\n]*Cosmic\.dll\r?\nFilter: ON PK Fc 6800 Hz Gain 1\.5 dB Q 1\.5(?:\r?\n|$)/gim,'')
 const lines=content.split(/\r?\n/),restored:string[]=[];let inside=false,blocks=0
 for(const line of lines){if(line===begin){if(inside||++blocks>1)throw Error('AMBIGUOUS_RECONCILIATION');inside=true;continue}if(line===end){if(!inside)throw Error('AMBIGUOUS_RECONCILIATION');inside=false;continue}if(!inside)restored.push(line.startsWith(muted)?line.slice(muted.length):line)}
 if(inside)throw Error('AMBIGUOUS_RECONCILIATION')
 const body=active?restored.map(line=>{const s=line.trim();const managedInclude=/^Include:\s*.*(?:at_v[123]|aiw_v3|(?:BO7[\\/]V5|data[\\/]eq[\\/]v5)|boost)/i.test(s);const previousEngine=/^VSTPlugin:.*(?:Lirio EQ|AstralCustom|Cosmic)/i.test(s);return managedInclude||previousEngine?muted+line:line}):restored
 const chain=cosmicChain().map(line=>active?line:'# '+line)
 return bom+[begin,...chain,end,...body].join('\r\n')
}
