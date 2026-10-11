export type AudioAccessPhase = 'signedOut' | 'checking' | 'analyzing' | 'downloading' | 'reconciling' | 'ready' | 'error';
export interface AudioAccessStatus {
    phase: AudioAccessPhase;
    username?: string;
    localTest?: boolean;
    stage?: string;
    code?: string;
}
