export interface VmDevice {
    key: string;
    name: string;
    type: number;
    hardwareId: string;
}
export interface VmChannel {
    name: string;
    gain: number;
    mute: boolean;
    peakDb: number;
}
export declare const vmDrivers: Record<number, string>;
export declare const vmSettingValues: {
    sr: number[];
    mme: number[];
    wdm: number[];
    ks: number[];
    asio: number[];
};
export type VmSetting = keyof typeof vmSettingValues;
export type VmSettings = Partial<Record<VmSetting, number>>;
export interface VmState {
    installed: boolean;
    connected: boolean;
    edition: number;
    inputs: VmDevice[];
    outputs: VmDevice[];
    strips: VmChannel[];
    bus: VmChannel;
    settings?: VmSettings;
    error?: string;
}
export type VmCommand = {
    action: 'device';
    target: 'input' | 'output';
    key: string;
} | {
    action: 'connect' | 'show' | 'hide' | 'restart';
} | {
    action: 'settings';
    values: VmSettings;
} | {
    action: 'route';
    input1: string;
    input2: string;
    output: string;
} | {
    action: 'gain' | 'mute';
    target: 'input' | 'output';
    index: number;
    value: number;
};
export interface AudioStartupState {
    supported: boolean;
    enabled: boolean;
}
export interface VoicemeeterAPI {
    audioStartupStatus: () => Promise<AudioStartupState>;
    audioStartupSet: (enabled: boolean) => Promise<AudioStartupState>;
    voicemeeterStatus: () => Promise<VmState>;
    voicemeeterCommand: (command: VmCommand) => Promise<VmState>;
}
