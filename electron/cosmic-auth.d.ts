import { type CosmicRolePolicy } from './cosmic-delivery';
export interface CosmicAccount {
    id: string;
    username: string;
}
export interface CosmicAuthOptions {
    directory: string;
    policy: CosmicRolePolicy;
    verify: (accessToken: string) => Promise<{
        id: string;
        username: string;
        roles: string[];
    }>;
}
export declare function createCosmicAuth(options: CosmicAuthOptions): {
    login: () => Promise<CosmicAccount>;
    checkSession: () => Promise<CosmicAccount>;
    authorizeDownload: () => Promise<string>;
    logout: () => Promise<void>;
};
