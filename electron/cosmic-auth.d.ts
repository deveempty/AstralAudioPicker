import { type CosmicRolePolicy } from './cosmic-delivery';
export interface CosmicAccount {
    id: string;
    username: string;
    avatarUrl?: string;
}
export interface CosmicAuthOptions {
    directory: string;
    policy: CosmicRolePolicy;
    verify: (accessToken: string) => Promise<{
        id: string;
        username: string;
        avatar?: string | null;
        roles: string[];
    }>;
}
export declare function createCosmicAuth(options: CosmicAuthOptions): {
    login: () => Promise<CosmicAccount>;
    checkSession: () => Promise<CosmicAccount>;
    authorizeDownload: () => Promise<string>;
    logout: () => Promise<void>;
};
