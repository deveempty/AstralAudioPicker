import type { TranslationKey } from './i18n'

export function communityErrorKey(code: string): TranslationKey {
  if (code === 'PROFILE_LIMIT_REACHED') return 'community.errorProfileLimit'
  if (['COMMUNITY_LOGIN_REQUIRED','LOGIN_REQUIRED','ACCESS_DENIED','SESSION_EXPIRED','ENOENT'].includes(code)) return 'community.errorLogin'
  if (['RATE_LIMITED','DISCORD_HTTP_429'].includes(code)) return 'community.errorRateLimited'
  if (['AUTH_BUSY','busy'].includes(code)) return 'community.errorBusy'
  if (['stale','CONFLICT'].includes(code)) return 'community.errorStale'
  if (code === 'NOT_FOUND') return 'community.errorMissing'
  if (code === 'COSMIC_NOT_ACTIVE') return 'community.errorInactive'
  if (['INVALID','INVALID_PROFILE','invalid','invalidPreset'].includes(code)) return 'community.errorInvalid'
  return 'community.errorService'
}

