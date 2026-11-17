import { readLoudness16 } from './loudness16';
import { readApoChain } from './apo-chain';
import type { DiagnosticCheck } from '../shared/diagnostics';
/** Read-only: checking diagnostics never enables effects or restarts audio. */
export declare function loudnessChecks(read?: typeof readLoudness16, readChain?: typeof readApoChain): Promise<DiagnosticCheck[]>;
export declare function legacyApoCheck(readChain?: typeof readApoChain): Promise<DiagnosticCheck>;
