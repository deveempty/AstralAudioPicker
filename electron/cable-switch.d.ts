type State = 'active' | 'disabled' | 'unknown';
export declare function switchVerifiedCable(target: string, previous: string, read: (id: string) => Promise<State>, set: (id: string, enabled: boolean) => Promise<boolean>): Promise<boolean>;
export {};
