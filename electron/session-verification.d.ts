export declare const verificationInterval: number;
export declare const verificationRetry = 30000;
export declare function accessErrorCode(error: unknown): string;
export declare function canRetryVerification(code: string, lastVerified: number, now: number): boolean;
