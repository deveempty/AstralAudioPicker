import type { ApoPatch } from './apo-repair-plan';
export declare const apoRepairWriteCore: string;
export declare function apoRepairWriteScript(patches: ApoPatch[], backupRoot: string, resultPath: string): string;
export declare function writeApoRepair(patches: ApoPatch[], backupRoot: string): Promise<void>;
