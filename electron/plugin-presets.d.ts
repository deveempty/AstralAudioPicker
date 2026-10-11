import { type SavedPluginProfile } from '../shared/plugin-control';
export declare class PresetError extends Error {
    readonly code: 'invalidName' | 'missingPreset' | 'invalidPreset' | 'storage' | 'busy' | 'stale';
    constructor(code: 'invalidName' | 'missingPreset' | 'invalidPreset' | 'storage' | 'busy' | 'stale');
}
export declare function pluginPresetDirectory(): string;
export declare class PluginPresetLibrary {
    readonly directory: string;
    constructor(directory: string);
    read(id: unknown): SavedPluginProfile;
    list(): SavedPluginProfile[];
    save(name: unknown, values: number[]): SavedPluginProfile;
}
