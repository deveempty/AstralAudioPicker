export interface Loudness16State {
    deviceId: string;
    enabled: boolean;
    releaseTime: number;
}
export type Loudness16Change = {
    enabled: boolean;
} | {
    releaseTime: number;
};
export interface LoudnessEqSettings {
    enabled: boolean;
    releaseTime: number;
}
export declare function validLoudnessEqSettings(value: unknown): value is LoudnessEqSettings;
