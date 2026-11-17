export declare const preparationSteps: readonly ["snapshot", "content", "headphones", "apo", "loudness", "relay", "verify"];
export type PreparationStep = typeof preparationSteps[number];
export interface PreparationState {
    phase: 'idle' | 'running' | 'error' | 'ready';
    step?: PreparationStep;
    completed: PreparationStep[];
    code?: string;
    version: string;
    percent?: number;
}
