import type { createVoicemeeter } from './voicemeeter';
import type { AudioUpgradeStatus } from '../shared/audio-upgrade';
export declare function preferredRelayEdition(): number;
export declare function createAudioUpgrade(vm: ReturnType<typeof createVoicemeeter>, prepareLoudness?: () => Promise<void>, relayOnly?: boolean): {
    status: () => AudioUpgradeStatus;
    prepare: () => Promise<AudioUpgradeStatus> | Promise<{
        phase: import("../shared/audio-upgrade").AudioUpgradePhase;
        code: string | undefined;
    }>;
    install: () => Promise<AudioUpgradeStatus> | Promise<{
        phase: import("../shared/audio-upgrade").AudioUpgradePhase;
        code: string | undefined;
    }>;
};
