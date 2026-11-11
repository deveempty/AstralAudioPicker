export declare const communityGames: readonly ["Warzone", "Black Ops 7", "Counter-Strike 2", "Valorant", "Other"];
export declare const communityFocuses: readonly ["focus", "balanced", "immersive"];
export type CommunityFocus = typeof communityFocuses[number];
export interface CommunityMetadata {
    name: string;
    game: string;
    headphones: string;
    focus: CommunityFocus;
    notes?: string;
}
export interface CommunityProfile extends CommunityMetadata {
    id: string;
    author: string;
    version: number;
    createdAt: string;
    saved: boolean;
    owned: boolean;
    applications?: number;
}
export interface CommunityPayload {
    schema: 'astral-community-cosmic';
    version: 1;
    stateVersion: 3;
    values: number[];
}
export interface CommunityQuery {
    tab: 'explore' | 'saved' | 'mine';
    search: string;
    game: string;
    page: number;
}
export interface CommunityPublication extends CommunityMetadata {
    requestId: string;
    source: string;
    revision: number;
}
export type CommunityResult<T> = {
    success: true;
    data: T;
} | {
    success: false;
    code: string;
};
export interface CommunityApplied {
    revision: number;
    engineConfirmed: boolean;
    applications?: number;
}
export interface CommunityAPI {
    communityList: (query: CommunityQuery) => Promise<CommunityResult<{
        profiles: CommunityProfile[];
        more: boolean;
    }>>;
    communityPublish: (publication: CommunityPublication) => Promise<CommunityResult<{
        id: string;
    }>>;
    communityApply: (id: string) => Promise<CommunityResult<CommunityApplied>>;
    communityUndo: () => Promise<CommunityResult<CommunityApplied>>;
    communityFavorite: (id: string, saved: boolean) => Promise<CommunityResult<{
        saved: boolean;
    }>>;
    communityReport: (id: string, reason: string) => Promise<CommunityResult<{
        reported: boolean;
    }>>;
    communityRemove: (id: string) => Promise<CommunityResult<{
        removed: boolean;
    }>>;
}
export declare const validCommunityId: (v: unknown) => v is string;
export declare function validCommunityMetadata(v: unknown): v is CommunityMetadata;
export declare function validCommunityPayload(v: unknown): v is CommunityPayload;
export declare function validCommunityProfile(v: unknown): v is CommunityProfile;
