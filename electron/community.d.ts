import { type CommunityApplied, type CommunityProfile, type CommunityPublication, type CommunityQuery, type CommunityResult } from '../shared/community';
import type { PluginControlStore } from './plugin-control';
export declare function createCommunity(options: {
    request: (route: string, init?: RequestInit) => Promise<Response>;
    store: PluginControlStore;
    isCosmicActive: () => boolean;
    activateCosmic: () => Promise<() => Promise<void>>;
}): {
    list: (query: CommunityQuery) => Promise<CommunityResult<{
        profiles: CommunityProfile[];
        more: boolean;
    }>>;
    publish: (publication: CommunityPublication) => Promise<CommunityResult<{
        id: string;
    }>>;
    apply: (id: string) => Promise<CommunityResult<CommunityApplied>>;
    undo: () => Promise<CommunityResult<CommunityApplied>>;
    favorite: (id: string, saved: boolean) => Promise<CommunityResult<{
        saved: boolean;
    }>>;
    report: (id: string, reason: string) => Promise<CommunityResult<{
        reported: boolean;
    }>>;
    remove: (id: string) => Promise<CommunityResult<{
        removed: boolean;
    }>>;
};
