export declare const apoIds: {
    readonly pre: "{EACD2258-FCAC-4FF4-B36D-419E924A6D79}";
    readonly post: "{EC1CC9CE-FAED-4822-828A-82A81A6F018F}";
};
export declare const windowsLoudnessIds: {
    readonly pre: "{62dc1a93-ae24-464c-a43e-452f824c4250}";
    readonly post: "{637c490d-eee3-4c0a-973f-371958802da2}";
};
export declare const fxSlot: (slot: number) => string;
export declare const enhancementFlag = "{1da5d803-d492-4edd-8c23-e0c0ffee7f0e},5";
export type RegistryValue = {
    kind: string;
    value: string | number | string[] | number[];
};
export type RegistryValues = Record<string, RegistryValue>;
export type CableKind = 'legacy' | 'v5';
export declare const cableNames: Record<CableKind, string>;
export declare const endpointActive: (state: number) => boolean;
export interface ApoEndpointState {
    id: string;
    name: string;
    adapter: string;
    state: number;
    fx: RegistryValues | null;
    child: RegistryValues | null;
}
export interface ApoInventory {
    endpoints: ApoEndpointState[];
    dlls: Record<string, string>;
    registered: boolean;
    windowsLoudnessAvailable?: boolean;
}
export interface ApoPatch {
    id: string;
    name: string;
    state: number;
    beforeFx: RegistryValues;
    beforeChild: RegistryValues | null;
    fx: Record<string, RegistryValue | null>;
    child: Record<string, RegistryValue | null>;
}
export declare function provisionedLoudnessEffects(inventory: ApoInventory, e: ApoEndpointState): {
    readonly pre: "{62dc1a93-ae24-464c-a43e-452f824c4250}";
    readonly post: "{637c490d-eee3-4c0a-973f-371958802da2}";
} | undefined;
export declare function selectApoEndpoint(inventory: ApoInventory, kind: CableKind): ApoEndpointState;
export declare function planApoRepair(inventory: ApoInventory): ApoPatch[];
