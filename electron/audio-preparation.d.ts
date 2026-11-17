import type { VmState } from '../shared/voicemeeter';
import type { Loudness16State } from '../shared/loudness16';
import type { AudioUpgradeStatus } from '../shared/audio-upgrade';
import type { createVoicemeeter } from './voicemeeter';
import type { createAudioUpgrade } from './audio-upgrade';
export declare function verifyRelayRoute(state: VmState): void;
interface Options {
    version: string;
    userData: string;
    resources: string;
    previousInstall: boolean;
    vm: ReturnType<typeof createVoicemeeter>;
    relay: ReturnType<typeof createAudioUpgrade>;
    loudness: {
        read: () => Promise<Loudness16State>;
        change: (value: {
            enabled: boolean;
        }) => Promise<Loudness16State>;
    };
    selected: () => {
        files: string[];
        v5Anchor: string | null;
        v5Game: 'BO7' | 'MW4';
        hasSelection: boolean;
    };
    applyV5: (file: string) => boolean;
    verifySelection: (source: string | null, game: 'BO7' | 'MW4') => boolean;
}
export declare function createAudioPreparation(options: Options): {
    busy: () => boolean;
    start: (force?: boolean) => Promise<import("../shared/post-update").PreparationState>;
    status: () => AudioUpgradeStatus;
};
export {};
