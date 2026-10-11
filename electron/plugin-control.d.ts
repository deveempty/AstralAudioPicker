import { PluginPresetLibrary } from './plugin-presets';
import { type PluginLibraryResult } from '../shared/plugin-control';
import { type PluginResult } from '../shared/plugin-control';
export declare class PluginControlStore {
    readonly root: string;
    readonly library: PluginPresetLibrary;
    constructor(root: string, presetDirectory?: string);
    private file;
    private readState;
    private write;
    private locked;
    private snapshot;
    private result;
    get(): PluginResult;
    patch(patch: unknown): PluginResult;
    private replaceValues;
    builtin(id: unknown): PluginResult;
    loadSaved(id: unknown): PluginResult;
    listSaved(): PluginLibraryResult;
    saveNamed(name: unknown, revision: unknown): PluginLibraryResult;
    select(profile: unknown): PluginResult;
}
export declare function pluginControlDirectory(): string;
