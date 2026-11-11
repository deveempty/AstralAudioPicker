import type { CommunityAPI, CommunityProfile } from '../shared/community'

// Read all saved pages once when the Profiles panel opens; never poll the cloud.
export async function savedCommunityLibrary(list: CommunityAPI['communityList'], cancelled: () => boolean): Promise<CommunityProfile[]> {
  const profiles = new Map<string, CommunityProfile>()
  for (let page = 0; page <= 1000; page++) {
    if (cancelled()) return []
    let result = await list({tab:'saved',search:'',game:'',page})
    for (let retry = 0; !result.success && ['busy','AUTH_BUSY'].includes(result.code) && retry < 3; retry++) {
      await new Promise(resolve => setTimeout(resolve, 500 * (retry + 1)))
      if (cancelled()) return []
      result = await list({tab:'saved',search:'',game:'',page})
    }
    if (cancelled()) return []
    if (!result.success) throw Error(result.code)
    for (const profile of result.data.profiles) if (profile.saved) profiles.set(profile.id, profile)
    if (!result.data.more) return [...profiles.values()]
  }
  throw Error('COMMUNITY_UNAVAILABLE')
}
