import { type BrowserWindow } from 'electron';
import { PluginPresetLibrary } from './plugin-presets';
import type { PluginTransferResult } from '../shared/plugin-control';
export declare function createPluginTransfer(library: PluginPresetLibrary, window: () => BrowserWindow | null): {
    import: () => Promise<PluginTransferResult>;
    export: (id: unknown) => Promise<PluginTransferResult>;
};
