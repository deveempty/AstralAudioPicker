import { type PreparationState, type PreparationStep } from '../shared/post-update';
export declare function createPostUpdate(directory: string, version: string, isExisting: () => Promise<boolean>, actions: Record<PreparationStep, (progress: (percent: number) => void) => Promise<void>>): {
    status: () => PreparationState;
    start: (force?: boolean) => Promise<PreparationState>;
};
