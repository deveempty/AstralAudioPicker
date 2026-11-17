import { readApoChain } from './apo-chain';
import type { Loudness16State } from '../shared/loudness16';
import type { AudioRepairResult } from '../shared/audio-repair';
/** Repair both cables before enabling LEQ on the verified 16-channel chain. */
export declare function createAudioRepair(loudness: {
    read: () => Promise<Loudness16State>;
    change: (value: {
        enabled: boolean;
    }) => Promise<Loudness16State>;
}, record: (entry: unknown) => Promise<void>, repairApo: () => Promise<unknown>, readChain?: typeof readApoChain): {
    busy: () => boolean;
    finish(): Promise<AudioRepairResult>;
};
