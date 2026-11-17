export declare function loudnessWriteScript(id: string, kind: 'enabled' | 'releaseTime', value: boolean | number, resultPath: string): string;
export declare function writeLoudness(id: string, kind: 'enabled' | 'releaseTime', value: boolean | number): Promise<boolean>;
