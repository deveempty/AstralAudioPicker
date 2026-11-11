export declare function stableVersion(value: unknown): value is string;
export declare function belowVersion(current: string, minimum: string): boolean;
export declare class RequiredUpdatePolicy {
    private file;
    private current;
    minimumVersion?: string;
    constructor(file: string, current: string);
    get required(): boolean;
    accept(release: string, minimum: unknown): void;
}
