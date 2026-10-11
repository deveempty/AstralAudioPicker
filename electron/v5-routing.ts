export type V5Slot='tune'|'headphone'
export function v5SlotIndex(lines:string[],slot:V5Slot):number {
 // Scope each device separately; Cosmic shares the device, but has no headphone EQ slot.
 const headers=lines.map((line,index)=>/^\s*#\s*AIW V5:/i.test(line)?index:-1).filter(i=>i>=0)
 let starts=headers
 if(!starts.length)starts=lines.map((line,index)=>/^\s*Device:\s*CABLE In 16ch\s*$/i.test(line)?index:-1).filter(i=>i>=0)
 for(const start of starts){let device=start;while(device<lines.length&&!/^\s*Device:/i.test(lines[device]))device++;if(device>=lines.length)continue
  let end=device+1;while(end<lines.length&&!/^\s*Device:/i.test(lines[end])&&!/^\s*#\s*(?:AIW V5|Cosmic|Legacy profiles):/i.test(lines[end]))end++
  const eq=lines.findIndex((line,i)=>i>device&&i<end&&/^\s*#\s*EQ\s*$/i.test(line));if(eq<0)continue
  const marker=slot==='headphone'?eq:lines.findIndex((line,i)=>i>device&&i<eq&&/^\s*#\s*16ch TUNE\s*$/i.test(line));if(marker<0)continue
  for(let i=marker+1;i<end;i++){if(/^\s*#\s*(?:EQ|OUTPUT BOOST|16ch TUNE)\s*$/i.test(lines[i]))break;if(/^\s*#?\s*Include:/i.test(lines[i]))return i}
 }
 return -1
}
export function setV5Route(content:string,active:boolean):string {
 const lines=content.split(/\r?\n/)
 for(const slot of ['tune','headphone'] as const){const i=v5SlotIndex(lines,slot);if(i>=0)lines[i]=(active?'':'# ')+lines[i].replace(/^\s*#?\s*/,'')}
 if(!active)for(let i=0;i<lines.length;i++)if(/^\s*Include:.*(?:ArtTuneDB[\\/])?boost\.txt\s*$/i.test(lines[i]))lines[i]='# '+lines[i]
 return lines.join(content.includes('\r\n')?'\r\n':'\n')
}
