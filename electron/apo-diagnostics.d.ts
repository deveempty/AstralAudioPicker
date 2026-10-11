export interface ApoEndpoint {
    name: string;
    modes: string[];
    missing: boolean;
    disabled: boolean;
}
export declare function readApoEndpoints(): Promise<ApoEndpoint[]>;
