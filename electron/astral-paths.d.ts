export declare const EQUALIZER_APO_CONFIG = "C:\\Program Files\\EqualizerAPO\\config";
export declare const MAIN_CONFIG_FILE: string;
export declare const ASTRAL_APP_DATA: string;
export declare const MEASUREMENTS_LIBRARY: string;
export declare const TARGETS_LIBRARY: string;
export declare const LEGACY_DEVICE_NAME = "Cable Input 7.1";
export declare const V5_DEVICE_NAME = "CABLE In 16ch";
export declare const LEGACY_DEVICE_GUID = "{9d2cc7d4-0bec-4041-a20e-f4e453232e78}";
export declare const V5_DEVICE_GUID = "{ec3aafdf-166d-46cd-9ea6-fa9cdd52b1c0}";
export declare function firstExistingDirectory(candidates: string[]): string | null;
export declare function findV5Library(): string | null;
export declare function findMeasurementsLibrary(): string | null;
export declare function findTargetsLibrary(): string | null;
export declare const PLUGIN_PATHS: {
    readonly vstV1: "C:\\Program Files\\VSTPlugins\\ArtTuneKit\\atk_spatial_engine_bravo_v1.0.2.dll";
    readonly vstV2: "C:\\Program Files\\VSTPlugins\\ArtTuneKit\\atk_spatial_engine_bravo_v2_0_0.dll";
    readonly jsfxEngine: "C:\\Program Files\\VSTPlugins\\ReaPlugs\\JS\\Effects\\ArtTune\\atk_spatial_engine.jsfx";
    readonly jsfxEnhancer: "C:\\Program Files\\VSTPlugins\\ReaPlugs\\JS\\Effects\\ArtTune\\atk_stereo_spatial_enhancer.jsfx";
};
