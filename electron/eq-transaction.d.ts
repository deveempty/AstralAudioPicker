export declare function validateGeneratedEq(text: string): void;
/** A write-ahead journal survives process termination; only listed EQ files change. */
export declare function commitEqFiles(files: Array<{
    target: string;
    data: Buffer;
}>, root: string, journalRoot: string): void;
