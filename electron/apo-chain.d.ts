import { type CableKind, type ApoInventory } from './apo-repair-plan';
export interface ApoChain {
    deviceId: string;
    active: boolean;
    pre: boolean;
    post: boolean;
    originalPre: boolean;
    originalPost: boolean;
    disabled: boolean;
}
export declare function readApoChain(kind?: CableKind): Promise<ApoChain>;
export declare function apoChainFromInventory(inventory: ApoInventory, kind?: CableKind): ApoChain;
export declare function verifyApoChain(chain: ApoChain): void;
