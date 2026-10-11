export declare function createAudioDevice(directory: string): {
    syncClock: (serverDate: string | null) => boolean;
    headers: () => Promise<{
        'X-Audio-HWID': string;
        'X-Audio-Key': string;
        'X-Audio-Time': string;
        'X-Audio-Nonce': string;
        'X-Audio-Signature': string;
    }>;
};
