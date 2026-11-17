import type { createVoicemeeter } from './voicemeeter';
import type { AudioUpgradeStatus } from '../shared/audio-upgrade';
export declare function preferredRelayEdition(): number;
export declare function createAudioUpgrade(vm: ReturnType<typeof createVoicemeeter>, prepareLoudness?: () => Promise<void>): {
    status: () => AudioUpgradeStatus;
    prepare: () => Promise<AudioUpgradeStatus>;
    install: () => Promise<AudioUpgradeStatus>;
};
