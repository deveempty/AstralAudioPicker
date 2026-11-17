import { readApoInventory } from './apo-inventory';
import { type ApoInventory } from './apo-repair-plan';
import { writeApoRepair } from './apo-repair-write';
export type ApoRepairProgress = 'apo-inspect' | 'apo-repair' | 'apo-readback';
export declare function createApoRepair(reconnect: <T>(operation: () => Promise<T>) => Promise<T>, dependencies?: {
    read: typeof readApoInventory;
    write: typeof writeApoRepair;
    pending: () => boolean;
}): (progress?: (stage: ApoRepairProgress) => void) => Promise<ApoInventory>;
