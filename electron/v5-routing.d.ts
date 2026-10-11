export type V5Slot = 'tune' | 'headphone';
export declare function v5SlotIndex(lines: string[], slot: V5Slot): number;
export declare function setV5Route(content: string, active: boolean): string;
