import type { DiagnosticReport } from '../shared/diagnostics';
export declare function inspectConfigTree(file: string): Promise<{
    missing: string[];
    invalid: string[];
    count: number;
}>;
export declare function runDiagnostics(): Promise<DiagnosticReport>;
