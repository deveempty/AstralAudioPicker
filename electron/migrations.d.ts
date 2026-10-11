export declare function runPendingMigrations(onProgress?: (message: string) => void): Promise<{
    success: boolean;
    migrated: boolean;
    error?: string;
}>;
