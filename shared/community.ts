import { validPluginValues } from './plugin-control'

export const communityGames = ['Warzone', 'Black Ops 7', 'Counter-Strike 2', 'Valorant', 'Other'] as const
export const communityFocuses = ['focus', 'balanced', 'immersive'] as const
export type CommunityFocus = typeof communityFocuses[number]
export interface CommunityMetadata { name: string; game: string; headphones: string; focus: CommunityFocus; notes?: string }
export interface CommunityProfile extends CommunityMetadata { id: string; author: string; version: number; createdAt: string; saved: boolean; owned: boolean; applications?: number }
export interface CommunityPayload { schema: 'astral-community-cosmic'; version: 1; stateVersion: 3; values: number[] }
export interface CommunityQuery { tab: 'explore' | 'saved' | 'mine'; search: string; game: string; page: number }
export interface CommunityPublication extends CommunityMetadata { requestId: string; source: string; revision: number }
export type CommunityResult<T> = { success: true; data: T } | { success: false; code: string }
export interface CommunityApplied { revision: number; engineConfirmed: boolean; applications?: number }
export interface CommunityAPI {
  communityList: (query: CommunityQuery) => Promise<CommunityResult<{ profiles: CommunityProfile[]; more: boolean }>>
  communityPublish: (publication: CommunityPublication) => Promise<CommunityResult<{ id: string }>>
  communityApply: (id: string) => Promise<CommunityResult<CommunityApplied>>
  communityUndo: () => Promise<CommunityResult<CommunityApplied>>
  communityFavorite: (id: string, saved: boolean) => Promise<CommunityResult<{ saved: boolean }>>
  communityReport: (id: string, reason: string) => Promise<CommunityResult<{ reported: boolean }>>
  communityRemove: (id: string) => Promise<CommunityResult<{ removed: boolean }>>
}
const text = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v)
export const validCommunityId = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v)
export function validCommunityMetadata(v: unknown): v is CommunityMetadata {
  if (!v || typeof v !== 'object') return false
  const p = v as CommunityMetadata
  return text(p.name, 60) && (p.notes === undefined || p.notes === '' || text(p.notes, 600)) && text(p.headphones, 80) && communityGames.includes(p.game as typeof communityGames[number]) && communityFocuses.includes(p.focus)
}
export function validCommunityPayload(v: unknown): v is CommunityPayload {
  if (!v || typeof v !== 'object') return false
  const p = v as CommunityPayload
  return p.schema === 'astral-community-cosmic' && p.version === 1 && p.stateVersion === 3 && validPluginValues(p.values)
}
export function validCommunityProfile(v: unknown): v is CommunityProfile {
  if (!validCommunityMetadata(v)) return false
  const p = v as CommunityProfile
  return validCommunityId(p.id) && text(p.author, 80) && p.version === 1 && typeof p.createdAt === 'string' && Number.isFinite(Date.parse(p.createdAt)) && typeof p.saved === 'boolean' && typeof p.owned === 'boolean' && (p.applications === undefined || (Number.isSafeInteger(p.applications) && p.applications >= 0))
}
