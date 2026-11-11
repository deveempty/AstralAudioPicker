// A previously verified open session gets a bounded retry window for transient
// failures only. Authorization denials and expired sessions always fail closed.
export const verificationInterval = 5 * 60_000
export const verificationRetry = 30_000
export function accessErrorCode(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError' || (error instanceof TypeError && /fetch|network/i.test(error.message))) return 'AUTH_UNAVAILABLE'
    if (/^[A-Z][A-Z0-9_]{1,63}$/.test(error.message)) return error.message
    const code = (error as NodeJS.ErrnoException).code
    if (code && /^[A-Z][A-Z0-9_]{1,63}$/.test(code)) return code
  }
  return 'VERIFICATION_FAILED'
}
export function canRetryVerification(code: string, lastVerified: number, now: number): boolean {
  const transient = ['AUTH_BUSY','AUTH_UNAVAILABLE','DISCORD_RATE_LIMITED','RATE_LIMITED','ECONNRESET','ECONNREFUSED','ENOTFOUND','EAI_AGAIN','ETIMEDOUT'].includes(code) || /^DISCORD_HTTP_(429|5\d\d)$/.test(code)
  return transient && lastVerified > 0 && now >= lastVerified && now - lastVerified < 15 * 60_000
}
