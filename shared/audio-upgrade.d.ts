export type AudioUpgradePhase = 'development' | 'checking' | 'downloading' | 'downloadingRelay' | 'content' | 'relay' | 'installing' | 'needsInstall' | 'needsRestart' | 'needsRoute' | 'conflict' | 'ready' | 'error';
export interface AudioUpgradeStatus {
    phase: AudioUpgradePhase;
    code?: string;
    operation?: string;
    preparation?: import('./post-update').PreparationState;
}
