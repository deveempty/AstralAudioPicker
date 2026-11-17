import type { VmCommand, VmState } from '../shared/voicemeeter';
export declare function relayRestartSettled(before: VmState, after: VmState): boolean;
export declare function createVoicemeeter(preferredEdition?: () => number): {
    status: () => Promise<VmState>;
    command: (request: VmCommand) => Promise<VmState>;
    withEndpointRestart: <T>(operation: () => Promise<T>) => Promise<T>;
    backupSettings: (file: string) => Promise<void>;
    executables(): Promise<{
        edition: number;
        path: string;
    }[]>;
    dispose(): void;
};
