export interface V5Preset {
    id: string;
    name: string;
    profile: string;
    weaponTuning: string;
    filename: string;
}
export interface HeadphoneEq {
    id: string;
    name: string;
    relativePath: string;
    brand?: string;
    model?: string;
    source?: string;
    type?: string;
    aliases?: string[];
    channel: 'Average';
}
export interface GeneratedHeadphoneEq {
    outputFile: string;
    headphoneName: string;
    source: string | null;
    channel: 'Average';
    target: string;
    smoothing: 5;
    range: '20-7500 Hz';
    meanError: number;
    maxError: number;
}
export interface GeneratedHeadphoneEqSet {
    atV1: GeneratedHeadphoneEq;
    aiwV3: GeneratedHeadphoneEq;
    aiwV5: GeneratedHeadphoneEq;
}
export declare function listV5Presets(): V5Preset[];
export declare function resolveV5Preset(filename: string): string | null;
export declare function listHeadphoneEqs(): HeadphoneEq[];
export declare function searchHeadphoneEqs(query: string, limit?: number, type?: string): {
    total: number;
    matchCount: number;
    results: HeadphoneEq[];
};
export declare function resolveHeadphoneEq(relativePath: string): string | null;
interface ParametricFilter {
    fc: number;
    gain: number;
    q: number;
}
export declare function optimizeParametricEq(frequencies: number[], target: number[], filterCount?: number): ParametricFilter[];
export interface AutoEqGenerationProgress {
    completed: number;
    total: 3;
    profile: 'AT V1' | 'AIW V3' | 'AIW V5';
    phase: 'generating' | 'completed';
    percent: number;
}
export declare function generateHeadphoneEqSet(measurementFile: string, onProgress?: (progress: AutoEqGenerationProgress) => void): Promise<GeneratedHeadphoneEqSet | null>;
export declare function getV5Readiness(): {
    presetLibrary: boolean;
    measurementsLibrary: boolean;
    targetsLibrary: boolean;
    plugins: {
        [k: string]: boolean;
    };
};
export {};
