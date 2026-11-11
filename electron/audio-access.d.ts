import type { AudioAccessStatus } from '../shared/audio-access';
export declare function createAudioAccess(configFile: string): {
    status: () => AudioAccessStatus;
    start: () => AudioAccessStatus;
    login: () => Promise<AudioAccessStatus>;
    retry: () => Promise<AudioAccessStatus>;
    requireReady: () => Promise<void>;
    communityRequest: (_route: string, _init?: RequestInit) => Promise<Response>;
    logout: () => Promise<AudioAccessStatus>;
};
