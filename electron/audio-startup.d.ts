export declare function startupXml(sid: string, executable: string): string;
export declare function audioStartupStatus(): Promise<{
    supported: false;
    enabled: boolean;
} | {
    supported: true;
    enabled: boolean;
}>;
export declare function audioStartupSet(enabled: unknown): Promise<{
    supported: false;
    enabled: boolean;
} | {
    supported: true;
    enabled: boolean;
}>;
