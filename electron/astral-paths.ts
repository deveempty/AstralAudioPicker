import fs from 'node:fs'
import path from 'node:path'

export const EQUALIZER_APO_CONFIG = 'C:\\Program Files\\EqualizerAPO\\config'
export const MAIN_CONFIG_FILE = path.join(EQUALIZER_APO_CONFIG, 'config.txt')
export const ASTRAL_APP_DATA = path.join(process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || 'C:\\Users\\Default', 'AppData', 'Local'), 'AstralAudio')
export const MEASUREMENTS_LIBRARY = path.join(ASTRAL_APP_DATA, 'measurements')
export const TARGETS_LIBRARY = path.join(ASTRAL_APP_DATA, 'targets')

export const LEGACY_DEVICE_NAME = 'Cable Input 7.1'
export const V5_DEVICE_NAME = 'CABLE In 16ch'
export const LEGACY_DEVICE_GUID = '{9d2cc7d4-0bec-4041-a20e-f4e453232e78}'
export const V5_DEVICE_GUID = '{ec3aafdf-166d-46cd-9ea6-fa9cdd52b1c0}'

const V5_LIBRARY_CANDIDATES = [
  path.join(EQUALIZER_APO_CONFIG, 'BO7', 'V5'),
  path.join(EQUALIZER_APO_CONFIG, 'data', 'BO7', 'V5'),
  path.join(EQUALIZER_APO_CONFIG, 'ArtTuneDB', 'library', 'BO7', 'V5'),
]

const MEASUREMENTS_CANDIDATES = [
  MEASUREMENTS_LIBRARY,
  // Previous development/install locations remain readable for migration.
  path.join(EQUALIZER_APO_CONFIG, 'measurements'),
  path.join(EQUALIZER_APO_CONFIG, 'data', 'measurements'),
  path.join(EQUALIZER_APO_CONFIG, 'ArtTuneDB', 'library', 'measurements'),
  // Development/reference library. This path is ignored in packaged installs
  // unless the workspace happens to exist on that machine.
  path.resolve(process.cwd(), '..', '..', 'ARCHIVOS', 'AT', 'AT - Nuevo Update', 'NUEVO AGREGAR', 'measurements'),
]

const TARGETS_CANDIDATES = [
  TARGETS_LIBRARY,
  path.resolve(process.cwd(), '..', '..', 'ARCHIVOS', 'AT', 'AT - Nuevo Update', '4 - Targets'),
]

export function firstExistingDirectory(candidates: string[]): string | null {
  return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) ?? null
}

export function findV5Library(): string | null {
  return firstExistingDirectory(V5_LIBRARY_CANDIDATES)
}

export function findMeasurementsLibrary(): string | null {
  const candidates = MEASUREMENTS_CANDIDATES.filter(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isDirectory())
  if (!candidates.length) return null

  // Prefer the complete indexed library instead of the legacy 22-file subset.
  return candidates.reduce((best, candidate) => {
    const database = path.join(candidate, 'database.json')
    const bestDatabase = path.join(best, 'database.json')
    const score = fs.existsSync(database) ? fs.statSync(database).size : 0
    const bestScore = fs.existsSync(bestDatabase) ? fs.statSync(bestDatabase).size : 0
    return score > bestScore ? candidate : best
  })
}

export function findTargetsLibrary(): string | null {
  return firstExistingDirectory(TARGETS_CANDIDATES)
}

export const PLUGIN_PATHS = {
  vstV1: 'C:\\Program Files\\VSTPlugins\\ArtTuneKit\\atk_spatial_engine_bravo_v1.0.2.dll',
  vstV2: 'C:\\Program Files\\VSTPlugins\\ArtTuneKit\\atk_spatial_engine_bravo_v2_0_0.dll',
  jsfxEngine: 'C:\\Program Files\\VSTPlugins\\ReaPlugs\\JS\\Effects\\ArtTune\\atk_spatial_engine.jsfx',
  jsfxEnhancer: 'C:\\Program Files\\VSTPlugins\\ReaPlugs\\JS\\Effects\\ArtTune\\atk_stereo_spatial_enhancer.jsfx',
} as const
