import { type PluginResult } from '../shared/plugin-control';
import type { DiagnosticCheck } from '../shared/diagnostics';
export declare function readCosmicHosts(): Promise<number[]>;
export declare function assessCosmicRuntime(before: PluginResult, after: PluginResult, hosts: number[] | null, now?: number): DiagnosticCheck;
export declare function cosmicRuntimeCheck(): Promise<DiagnosticCheck>;
