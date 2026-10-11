export interface CosmicRelease {
    version: string;
    url: string;
    sha256: string;
    size: number;
}
export type CosmicRolePolicy = {
    roles: [string, string];
    mode: 'all' | 'any';
};
export declare function hasCosmicAccess(actual: string[], policy: CosmicRolePolicy): boolean;
export declare function reconcileCosmicText(original: string, managedText: string): string;
export interface CosmicDeliveryOptions {
    installDirectory: string;
    configFile: string;
    allowedOrigin: string;
    release: CosmicRelease;
    authorize: () => Promise<string | null>;
    managedText: (absoluteDll: string) => string;
    transformConfig?: (original: string) => string;
    onPhase?: (phase: 'downloading' | 'reconciling') => void;
    fetcher?: typeof fetch;
}
export declare function reconcileCosmicDelivery(options: CosmicDeliveryOptions): Promise<{
    changed: boolean;
    dll: string;
}>;
