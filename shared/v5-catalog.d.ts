export type V5Game = 'BO7' | 'MW4';
export type V5Hrir = 'Native' | 'KEMAR' | 'KU100';
export declare function parseV5Preset(filename: string): {
    game: "MW4";
    profile: string;
    weaponTuning: string;
    hrir: V5Hrir;
} | {
    game: "BO7";
    profile: string;
    weaponTuning: string;
    hrir: "Native";
} | null;
