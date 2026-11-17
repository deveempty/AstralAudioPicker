import https from 'node:https';
export interface DownloadSpec {
    name: string;
    sha256: string;
    bytes: number;
}
export declare function downloadAssetPath(spec: DownloadSpec): string;
export declare function downloadVerified(spec: DownloadSpec, destination: string, get?: typeof https.get): Promise<void>;
export declare function withDownloadedAsset<T>(spec: DownloadSpec, work: (file: string, workspace: string) => Promise<T>, download?: typeof downloadVerified): Promise<T>;
export declare function cleanAbandonedAudioDownloads(): Promise<void>;
