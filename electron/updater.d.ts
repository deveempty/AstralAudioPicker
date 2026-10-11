import { BrowserWindow } from 'electron';
export type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'migrating' | 'error' | 'development';
export interface UpdateStatus {
    phase: UpdatePhase;
    version?: string;
    progress?: number;
    message?: string;
}
export declare function publishMigrationStatus(status: UpdateStatus): void;
export declare function attachUpdaterWindow(browserWindow: BrowserWindow): void;
export declare function checkForPickerUpdates(): Promise<boolean>;
export declare function initializeAutoUpdater(browserWindow: BrowserWindow): void;
