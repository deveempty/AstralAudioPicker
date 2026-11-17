import { type LoudnessEqSettings, type Loudness16State, type Loudness16Change } from '../shared/loudness16';
export interface CommunityLoudness {
    read: () => Promise<Loudness16State>;
    change: (change: Loudness16Change) => Promise<Loudness16State>;
    changed?: () => void;
    verifyActive?: (deviceId: string) => Promise<void>;
}
export declare const sameLoudness: (a: LoudnessEqSettings, b: LoudnessEqSettings) => boolean;
export declare function readCommunityLoudness(service?: CommunityLoudness): Promise<LoudnessEqSettings>;
/** Only the existing 16ch adapter receives writes. No device identity travels in profiles. */
export declare function applyCommunityLoudness(service: CommunityLoudness | undefined, target: LoudnessEqSettings): Promise<{
    before: {
        enabled: boolean;
        releaseTime: number;
    };
    restore: () => Promise<void>;
}>;
