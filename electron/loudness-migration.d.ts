import type { Loudness16State } from '../shared/loudness16';
export declare function ensureLoudness16Enabled(directory: string, read: () => Promise<Loudness16State>, enable: () => Promise<Loudness16State>): Promise<void>;
