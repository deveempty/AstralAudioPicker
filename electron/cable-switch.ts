type State = 'active' | 'disabled' | 'unknown'
export async function switchVerifiedCable(target: string, previous: string, read: (id:string)=>Promise<State>, set:(id:string, enabled:boolean)=>Promise<boolean>):Promise<boolean> {
  const beforeTarget = await read(target)
  const beforePrevious = await read(previous)
  if (beforeTarget === 'unknown' || beforePrevious === 'unknown') return false
  if (beforeTarget !== 'active' && !await set(target,true)) return false
  if (beforePrevious === 'disabled' || await set(previous,false)) return true
  // Restore the old output before undoing the destination. A failed rollback
  // must never remove the only remaining active output.
  const restored = await read(previous) === 'active' || await set(previous,true)
  if (restored && beforeTarget === 'disabled') await set(target,false)
  return false
}
