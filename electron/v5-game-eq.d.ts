import type { V5Game } from '../shared/v5-catalog';
export declare function matchingGameEq(currentFile: string, game: V5Game): string | null;
export declare function initialGameEq(file: string): string | null;
export declare function headphoneSource(file: string): string | null;
export declare function selectedHeadphone(current: string | null, legacy: string[]): string | null;
export declare function gameEqForHeadphone(anchor: string, folder: string, game: V5Game): string | null;
