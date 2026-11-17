export interface ContentFile {
    path: string;
    sha256: string;
    bytes: number;
}
export interface ContentManifest {
    id: string;
    archiveSha256: string;
    archiveBytes: number;
    files: ContentFile[];
    installerSha256: string;
    installerBytes: number;
}
export declare function contentDestination(relative: string, roots: Record<string, string>): string;
export declare function applyContentFiles(source: string, manifest: ContentManifest, roots: Record<string, string>, backup: string): Promise<number>;
export declare function installAudioContent(resources: string, apo: string, localData: string, migrationRoot: string, onPhase?: (phase: 'downloading' | 'content') => void): Promise<void>;
export declare function migrateV5Includes(apo: string, migrationRoot: string): Promise<void>;
