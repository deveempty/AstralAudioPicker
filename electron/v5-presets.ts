import fs from 'node:fs'
import path from 'node:path'
import { findMeasurementsLibrary, findTargetsLibrary, findV5Library, PLUGIN_PATHS } from './astral-paths'
import { EQUALIZER_APO_CONFIG } from './astral-paths'

export interface V5Preset {
  id: string
  name: string
  profile: string
  weaponTuning: string
  filename: string
}

export interface HeadphoneEq {
  id: string
  name: string
  relativePath: string
  brand?: string
  model?: string
  source?: string
  type?: string
  aliases?: string[]
  channel: 'Average'
}

export interface GeneratedHeadphoneEq {
  outputFile: string
  headphoneName: string
  source: string | null
  channel: 'Average'
  target: string
  smoothing: 5
  range: '20-7500 Hz'
  meanError: number
  maxError: number
}

export interface GeneratedHeadphoneEqSet {
  atV1: GeneratedHeadphoneEq
  aiwV3: GeneratedHeadphoneEq
  aiwV5: GeneratedHeadphoneEq
}

interface MeasurementDatabaseEntry {
  id: string
  brand: string
  model: string
  file: string
  source: string
  type: string
  aliases?: string[]
}

let measurementIndexCache: { root: string; modifiedAt: number; entries: HeadphoneEq[] } | null = null

const V5_FILENAME = /^BO7_V5_16ch_([^-]+)-(.+)\.txt$/i

function safeTxtPath(root: string, relativePath: string): string | null {
  const resolvedRoot = path.resolve(root)
  const resolvedFile = path.resolve(root, relativePath)
  if (!resolvedFile.startsWith(`${resolvedRoot}${path.sep}`) || path.extname(resolvedFile).toLowerCase() !== '.txt') {
    return null
  }
  return resolvedFile
}

export function listV5Presets(): V5Preset[] {
  const root = findV5Library()
  if (!root) return []

  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    if (!entry.isFile()) return []
    const match = entry.name.match(V5_FILENAME)
    if (!match) return []
    const [, profile, weaponTuning] = match
    return [{
      id: entry.name.slice(0, -4),
      name: `${profile} · ${weaponTuning.replace(/Gun$/i, ' Gun')}`,
      profile,
      weaponTuning,
      filename: entry.name,
    }]
  }).sort((a, b) => a.name.localeCompare(b.name))
}

export function resolveV5Preset(filename: string): string | null {
  if (!V5_FILENAME.test(filename)) return null
  const root = findV5Library()
  if (!root) return null
  const file = safeTxtPath(root, filename)
  return file && fs.existsSync(file) ? file : null
}

function walkTxtFiles(root: string, directory = root): HeadphoneEq[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return walkTxtFiles(root, fullPath)
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.txt') return []
    const relativePath = path.relative(root, fullPath)
    return [{ id: relativePath, name: entry.name.slice(0, -4), relativePath, channel: 'Average' as const }]
  })
}

export function listHeadphoneEqs(): HeadphoneEq[] {
  const root = findMeasurementsLibrary()
  if (!root) return []
  return loadMeasurementIndex(root).slice(0, 100)
}

function loadMeasurementIndex(root: string): HeadphoneEq[] {
  const databaseFile = path.join(root, 'database.json')
  if (fs.existsSync(databaseFile)) {
    try {
      const modifiedAt = fs.statSync(databaseFile).mtimeMs
      if (measurementIndexCache?.root === root && measurementIndexCache.modifiedAt === modifiedAt) {
        return measurementIndexCache.entries
      }
      const database = JSON.parse(fs.readFileSync(databaseFile, 'utf8')) as { entries?: MeasurementDatabaseEntry[] }
      if (Array.isArray(database.entries)) {
        const entries = database.entries.flatMap(entry => {
          const file = safeTxtPath(root, entry.file)
          if (!file || !fs.existsSync(file)) return []
          return [{
            id: entry.id,
            name: `${entry.brand} ${entry.model}`.trim(),
            relativePath: entry.file,
            brand: entry.brand,
            model: entry.model,
            source: entry.source,
            type: entry.type,
            aliases: entry.aliases,
            channel: 'Average' as const,
          }]
        })
        measurementIndexCache = { root, modifiedAt, entries }
        return entries
      }
    } catch (error) {
      console.error('Unable to read measurements database:', error)
    }
  }
  return walkTxtFiles(root).sort((a, b) => a.name.localeCompare(b.name))
}

export function searchHeadphoneEqs(query: string, limit = 80, type = 'all'): { total: number; matchCount: number; results: HeadphoneEq[] } {
  const root = findMeasurementsLibrary()
  if (!root) return { total: 0, matchCount: 0, results: [] }
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const index = loadMeasurementIndex(root)
  const textMatches = normalizedQuery
    ? index.filter(entry => [entry.name, entry.brand, entry.model, entry.source, ...(entry.aliases ?? [])].some(value => value?.toLocaleLowerCase().includes(normalizedQuery)))
    : index
  const matches = type === 'all' ? textMatches : textMatches.filter(entry => entry.type === type)
  return { total: index.length, matchCount: matches.length, results: matches.slice(0, Math.max(1, Math.min(limit, 200))) }
}

export function resolveHeadphoneEq(relativePath: string): string | null {
  const root = findMeasurementsLibrary()
  if (!root) return null
  const file = safeTxtPath(root, relativePath)
  return file && fs.existsSync(file) ? file : null
}

interface FrequencyPoint { frequency: number; amplitude: number }

function parseFrequencyCurve(file: string): FrequencyPoint[] {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).flatMap(line => {
    const [frequencyText, amplitudeText] = line.trim().split(/[\s,;]+/)
    const frequency = Number(frequencyText)
    const amplitude = Number(amplitudeText)
    return Number.isFinite(frequency) && Number.isFinite(amplitude) && frequency >= 20 && frequency <= 20000
      ? [{ frequency, amplitude }]
      : []
  }).sort((a, b) => a.frequency - b.frequency)
}

// Squiglink's Equalizer.interp uses linear-frequency interpolation. Keeping
// this identical matters most for the sparse target/measurement transitions
// that seed the first AutoEQ filter batch.
function interpolateCurve(points: FrequencyPoint[], frequency: number): number {
  if (frequency <= points[0].frequency) return points[0].amplitude
  if (frequency >= points[points.length - 1].frequency) return points[points.length - 1].amplitude
  let low = 0
  let high = points.length - 1
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2)
    if (points[middle].frequency <= frequency) low = middle
    else high = middle
  }
  const left = points[low]
  const right = points[high]
  const ratio = (frequency - left.frequency) / (right.frequency - left.frequency)
  return left.amplitude + ratio * (right.amplitude - left.amplitude)
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)
}

interface ParametricFilter { fc: number; gain: number; q: number }

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}

// RBJ peaking biquad magnitude, matching Equalizer APO's PK filter behavior.
function peakingResponseDb(frequency: number, filter: ParametricFilter, sampleRate = 48000): number {
  const a = Math.pow(10, filter.gain / 40)
  const omega = 2 * Math.PI * filter.fc / sampleRate
  const alpha = Math.sin(omega) / (2 * filter.q)
  const a0 = 1 + alpha / a
  const coefficients = [
    1,
    (-2 * Math.cos(omega)) / a0,
    (1 - alpha / a) / a0,
    (1 + alpha * a) / a0,
    (-2 * Math.cos(omega)) / a0,
    (1 - alpha * a) / a0,
  ]
  const [ca0, ca1, ca2, b0, b1, b2] = coefficients
  const w = 2 * Math.PI * frequency / sampleRate
  const phi = 4 * Math.pow(Math.sin(w / 2), 2)
  return 10 * Math.log10(Math.pow(b0 + b1 + b2, 2) + (b0 * b2 * phi - (b1 * (b0 + b2) + 4 * b0 * b2)) * phi)
    - 10 * Math.log10(Math.pow(ca0 + ca1 + ca2, 2) + (ca0 * ca2 * phi - (ca1 * (ca0 + ca2) + 4 * ca0 * ca2)) * phi)
}

function combinedResponse(frequency: number, filters: ParametricFilter[]): number {
  return filters.reduce((sum, filter) => sum + peakingResponseDb(frequency, filter), 0)
}

// The optimizer evaluates thousands of candidate filters against the same
// frequency grid. Cache its frequency-only term and calculate each filter's
// coefficients once per candidate instead of once per frequency point.
const phiCache = new WeakMap<number[], Float64Array>()

function frequencyPhis(frequencies: number[], sampleRate = 48000): Float64Array {
  const cached = phiCache.get(frequencies)
  if (cached) return cached
  const values = new Float64Array(frequencies.length)
  for (let index = 0; index < frequencies.length; index++) {
    const w = 2 * Math.PI * frequencies[index] / sampleRate
    const sine = Math.sin(w / 2)
    values[index] = 4 * sine * sine
  }
  phiCache.set(frequencies, values)
  return values
}

function filterResponseArray(frequencies: number[], filter: ParametricFilter[], sampleRate?: number): number[]
function filterResponseArray(frequencies: number[], filter: ParametricFilter, sampleRate?: number): number[]
function filterResponseArray(frequencies: number[], filter: ParametricFilter | ParametricFilter[], sampleRate = 48000): number[] {
  if (Array.isArray(filter)) {
    const response = new Array<number>(frequencies.length).fill(0)
    for (const item of filter) {
      const itemResponse = filterResponseArray(frequencies, item, sampleRate)
      for (let index = 0; index < response.length; index++) response[index] += itemResponse[index]
    }
    return response
  }

  const a = Math.pow(10, filter.gain / 40)
  const omega = 2 * Math.PI * filter.fc / sampleRate
  const alpha = Math.sin(omega) / (2 * filter.q)
  const a0 = 1 + alpha / a
  const ca0 = 1
  const ca1 = (-2 * Math.cos(omega)) / a0
  const ca2 = (1 - alpha / a) / a0
  const b0 = (1 + alpha * a) / a0
  const b1 = ca1
  const b2 = (1 - alpha * a) / a0
  const numeratorBase = Math.pow(b0 + b1 + b2, 2)
  const numeratorPhi = b0 * b2
  const numeratorInner = b1 * (b0 + b2) + 4 * b0 * b2
  const denominatorBase = Math.pow(ca0 + ca1 + ca2, 2)
  const denominatorPhi = ca0 * ca2
  const denominatorInner = ca1 * (ca0 + ca2) + 4 * ca0 * ca2
  const phis = frequencyPhis(frequencies, sampleRate)
  const response = new Array<number>(frequencies.length)
  for (let index = 0; index < response.length; index++) {
    const phi = phis[index]
    response[index] = 10 * Math.log10(numeratorBase + (numeratorPhi * phi - numeratorInner) * phi)
      - 10 * Math.log10(denominatorBase + (denominatorPhi * phi - denominatorInner) * phi)
  }
  return response
}

const AUTO_EQ_RANGE = [20, 7500] as const
const SMOOTHING_LEVEL = 5 as const
const Q_RANGE = [0.5, 10] as const
const GAIN_RANGE = [-12, 12] as const
const OPTIMIZE_DELTAS = [
  [10, 10, 10, 5, 0.1, 0.5],
  [10, 10, 10, 2, 0.1, 0.2],
  [10, 10, 10, 1, 0.1, 0.1],
] as const

// Two-pass candidate search and refinement ported from the zero-clause BSD
// CrinGraph/Squiglink equalizer algorithm, configured for the user's 20–7500 Hz workflow.

function frequencyUnit(frequency: number): number {
  if (frequency < 100) return 1
  if (frequency < 1000) return 10
  if (frequency < 10000) return 100
  return 1000
}

function stripFilters(filters: ParametricFilter[]): ParametricFilter[] {
  return filters.map(filter => ({
    fc: Math.floor(filter.fc - filter.fc % frequencyUnit(filter.fc)),
    q: clamp(Math.floor(filter.q * 10) / 10, Q_RANGE[0], Q_RANGE[1]),
    gain: clamp(Math.floor(filter.gain * 10) / 10, GAIN_RANGE[0], GAIN_RANGE[1]),
  }))
}

function responseArray(frequencies: number[], filters: ParametricFilter[]): number[] {
  return filterResponseArray(frequencies, filters)
}

function squigDistance(response: number[], target: number[]): number {
  return response.reduce((sum, value, index) => {
    const difference = Math.abs(value - target[index])
    return sum + (difference >= 0.1 ? difference : 0)
  }, 0) / response.length
}

function searchCandidates(frequencies: number[], response: number[], target: number[], threshold: number): ParametricFilter[] {
  let state = 0
  let startIndex = -1
  const candidates: ParametricFilter[] = []
  for (let index = 0; index < frequencies.length; index++) {
    const delta = response[index] - target[index]
    const absolute = Math.abs(delta)
    const nextState = absolute < threshold ? 0 : delta / absolute
    if (nextState === state) continue
    if (startIndex >= 0) {
      if (state !== 0) {
        const start = frequencies[startIndex]
        const end = frequencies[index]
        const center = Math.sqrt(start * end)
        if (center >= AUTO_EQ_RANGE[0] && center <= AUTO_EQ_RANGE[1]) {
          const interpolateSlice = (values: number[]) => {
            let rightIndex = Math.min(index, frequencies.length - 1)
            while (rightIndex > startIndex && frequencies[rightIndex] > center) rightIndex--
            const leftIndex = rightIndex
            rightIndex = Math.min(leftIndex + 1, index)
            if (leftIndex === rightIndex) return values[leftIndex]
            const ratio = (center - frequencies[leftIndex]) / (frequencies[rightIndex] - frequencies[leftIndex])
            return values[leftIndex] + ratio * (values[rightIndex] - values[leftIndex])
          }
          candidates.push({ fc: center, q: center / Math.max(end - start, 1), gain: interpolateSlice(target) - interpolateSlice(response) })
        }
      }
      startIndex = -1
    } else {
      startIndex = index
    }
    state = nextState
  }
  return candidates
}

function optimizeSquigPass(frequencies: number[], target: number[], inputFilters: ParametricFilter[], iteration: number, reverse = false): ParametricFilter[] {
  const filters = stripFilters(inputFilters)
  const [maxDF, maxDQ, maxDG, stepDF, stepDQ, stepDG] = OPTIMIZE_DELTAS[iteration]
  const indexes = [...filters.keys()]
  if (reverse) indexes.reverse()
  for (const index of indexes) {
    const original = filters[index]
    const otherFilters = filters.filter((_, filterIndex) => filterIndex !== index)
    const baseResponse = responseArray(frequencies, otherFilters)
    let bestFilter = original
    const candidateDistance = (candidate: ParametricFilter) => {
      const candidateResponse = filterResponseArray(frequencies, candidate)
      let distance = 0
      for (let responseIndex = 0; responseIndex < baseResponse.length; responseIndex++) {
        const difference = Math.abs(baseResponse[responseIndex] + candidateResponse[responseIndex] - target[responseIndex])
        if (difference >= 0.1) distance += difference
      }
      return distance / baseResponse.length
    }
    let bestDistance = candidateDistance(original)
    const test = (df: number, dq: number, dg: number) => {
      const candidate: ParametricFilter = {
        fc: original.fc + df * frequencyUnit(original.fc) * stepDF,
        q: original.q + dq * stepDQ,
        gain: original.gain + dg * stepDG,
      }
      if (candidate.fc < AUTO_EQ_RANGE[0] || candidate.fc > AUTO_EQ_RANGE[1] || candidate.q < Q_RANGE[0] || candidate.q > Q_RANGE[1] || candidate.gain < GAIN_RANGE[0] || candidate.gain > GAIN_RANGE[1]) return false
      const distance = candidateDistance(candidate)
      if (distance < bestDistance) { bestFilter = candidate; bestDistance = distance; return true }
      return false
    }
    for (let df = -maxDF; df < maxDF; df++) {
      for (let dq = maxDQ - 1; dq >= -maxDQ; dq--) {
        for (let dg = 1; dg < maxDG; dg++) if (!test(df, dq, dg)) break
        for (let dg = -1; dg >= -maxDG; dg--) if (!test(df, dq, dg)) break
      }
    }
    filters[index] = bestFilter
  }
  if (!reverse) return optimizeSquigPass(frequencies, target, filters, iteration, true)
  const cleaned = stripFilters(filters).sort((left, right) => left.fc - right.fc)
  // Squiglink merges adjacent equivalent filters, then removes bands whose
  // absence improves the fit. This prevents redundant compensating bands.
  for (let index = 0; index < cleaned.length - 1;) {
    const left = cleaned[index]
    const right = cleaned[index + 1]
    if (Math.abs(left.fc - right.fc) <= frequencyUnit(left.fc) && Math.abs(left.q - right.q) <= 0.1) {
      left.gain += right.gain
      cleaned.splice(index + 1, 1)
    } else index++
  }
  let bestDistance = squigDistance(responseArray(frequencies, cleaned), target)
  for (let index = 0; index < cleaned.length;) {
    if (Math.abs(cleaned[index].gain) <= 0.1) { cleaned.splice(index, 1); continue }
    const without = cleaned.filter((_, candidateIndex) => candidateIndex !== index)
    const distance = squigDistance(responseArray(frequencies, without), target)
    if (distance < bestDistance) { cleaned.splice(index, 1); bestDistance = distance }
    else index++
  }
  return cleaned
}

export function optimizeParametricEq(frequencies: number[], target: number[], filterCount = 10): ParametricFilter[] {
  const firstBatchSize = Math.max(Math.floor(filterCount / 2) - 1, 1)
  let firstFilters = searchCandidates(frequencies, new Array(frequencies.length).fill(0), target, 1)
    .filter(candidate => candidate.fc <= 7000).sort((left, right) => left.q - right.q).slice(0, firstBatchSize).sort((left, right) => left.fc - right.fc)
  for (let iteration = 0; iteration < OPTIMIZE_DELTAS.length; iteration++) firstFilters = optimizeSquigPass(frequencies, target, firstFilters, iteration)
  const secondResponse = responseArray(frequencies, firstFilters)
  let secondFilters = searchCandidates(frequencies, secondResponse, target, 0.5)
    .sort((left, right) => left.q - right.q).slice(0, filterCount - firstFilters.length).sort((left, right) => left.fc - right.fc)
  for (let iteration = 0; iteration < OPTIMIZE_DELTAS.length; iteration++) secondFilters = optimizeSquigPass(frequencies, target.map((value, index) => value - secondResponse[index]), secondFilters, iteration)
  let allFilters = firstFilters.concat(secondFilters)
  for (let iteration = 0; iteration < OPTIMIZE_DELTAS.length; iteration++) allFilters = optimizeSquigPass(frequencies, target, allFilters, iteration)
  return stripFilters(allFilters).slice(0, filterCount)
}

export interface AutoEqGenerationProgress {
  completed: number
  total: 3
  profile: 'AT V1' | 'AIW V3' | 'AIW V5'
  phase: 'generating' | 'completed'
  percent: number
}

export async function generateHeadphoneEqSet(
  measurementFile: string,
  onProgress?: (progress: AutoEqGenerationProgress) => void,
): Promise<GeneratedHeadphoneEqSet | null> {
  const targetsRoot = findTargetsLibrary()
  if (!targetsRoot) return null
  const measurementsRoot = findMeasurementsLibrary()
  const measurementRelativePath = measurementsRoot ? path.relative(measurementsRoot, measurementFile) : null
  const metadata = measurementsRoot && measurementRelativePath
    ? loadMeasurementIndex(measurementsRoot).find(entry => entry.relativePath.toLocaleLowerCase() === measurementRelativePath.toLocaleLowerCase())
    : undefined
  const measurement = parseFrequencyCurve(measurementFile)
  if (measurement.length < 20) return null

  // Gadgetry Tech Squiglink first linearly interpolates every raw channel and
  // uploaded target onto its shared 1/48-octave f_values grid.
  const frequencies = [20]
  const frequencyStep = Math.pow(2, 1 / 48)
  while (frequencies[frequencies.length - 1] < 20000) frequencies.push(frequencies[frequencies.length - 1] * frequencyStep)
  const rawMeasurement = frequencies.map(frequency => interpolateCurve(measurement, frequency))
  const normalizationIndex = frequencies.findIndex(frequency => frequency > 500)
  const measurementReference = rawMeasurement[normalizationIndex]
  const reviewer = metadata?.source?.split('/').slice(1).join(' - ')
  const descriptiveName = metadata ? `${metadata.name}${reviewer ? ` - ${reviewer}` : ''}` : path.basename(measurementFile, '.txt')
  const safeName = descriptiveName.replace(/[^a-z0-9._ -]/gi, '_')
  const metadataHeader = metadata
    ? `# Headphone: ${metadata.name}\r\n# Source file: ${metadata.relativePath}\r\n`
    : `# Headphone: ${path.basename(measurementFile, '.txt')}\r\n# Source file: ${path.basename(measurementFile)}\r\n`

  const generateVersion = (
    profileLabel: 'AT V1' | 'AIW V3' | 'AIW V5',
    targetVersion: 'v2' | 'v3' | 'v5',
    outputFolder: 'v2' | 'v3' | 'v5',
  ): GeneratedHeadphoneEq | null => {
    const targetVersionLabel = targetVersion.toUpperCase()
    const targetFile = path.join(targetsRoot, 'Target', `Target_${targetVersionLabel}.txt`)
    if (!fs.existsSync(targetFile)) return null
    const target = parseFrequencyCurve(targetFile)
    if (target.length < 20) return null
    const rawTarget = frequencies.map(frequency => interpolateCurve(target, frequency))
    const targetReference = rawTarget[normalizationIndex]
    const correction = frequencies.map((_, index) => (rawTarget[index] - targetReference) - (rawMeasurement[index] - measurementReference))
    const filters = optimizeParametricEq(frequencies, correction, 10)
    const fitErrors = frequencies.flatMap((frequency, index) => frequency <= AUTO_EQ_RANGE[1]
      ? [Math.abs(correction[index] - combinedResponse(frequency, filters))]
      : [])
    const meanError = average(fitErrors)
    const maxError = Math.max(...fitErrors)
    const maximumBoost = Math.max(0, ...frequencies.map(frequency => combinedResponse(frequency, filters)))
    const preamp = -Math.ceil(maximumBoost * 10) / 10
    const outputDirectory = path.join(EQUALIZER_APO_CONFIG, 'data', 'eq', outputFolder)
    fs.mkdirSync(outputDirectory, { recursive: true })
    const outputFile = path.join(outputDirectory, `${safeName}.txt`)
    const targetName = `BO7 Target ${targetVersionLabel}`
    const filterLines = filters.map((filter, index) => `Filter ${index + 1}: ON PK Fc ${Math.round(filter.fc)} Hz Gain ${filter.gain.toFixed(1)} dB Q ${filter.q.toFixed(1)}`).join('\r\n')
    fs.writeFileSync(outputFile, `# Generated by Astral Audio Picker for ${profileLabel}\r\n# Target: ${targetName}\r\n${metadataHeader}Preamp: ${preamp.toFixed(1)} dB\r\n${filterLines}\r\n`, 'utf8')
    return {
      outputFile,
      headphoneName: metadata?.name ?? path.basename(measurementFile, '.txt'),
      source: metadata?.source ?? null,
      channel: 'Average',
      target: targetName,
      smoothing: SMOOTHING_LEVEL,
      range: '20-7500 Hz',
      meanError: Number(meanError.toFixed(2)),
      maxError: Number(maxError.toFixed(2)),
    }
  }

  const yieldToElectron = (delay = 0) => new Promise<void>(resolve => setTimeout(resolve, delay))
  const generateStage = async (
    completed: number,
    label: 'AT V1' | 'AIW V3' | 'AIW V5',
    targetVersion: 'v2' | 'v3' | 'v5',
    outputFolder: 'v2' | 'v3' | 'v5',
  ) => {
    onProgress?.({ completed, total: 3, profile: label, phase: 'generating', percent: Math.round(completed / 3 * 100) })
    await yieldToElectron()
    const result = generateVersion(label, targetVersion, outputFolder)
    onProgress?.({ completed: completed + 1, total: 3, profile: label, phase: 'completed', percent: Math.round((completed + 1) / 3 * 100) })
    // Let Chromium paint the completed stage before starting the next optimizer.
    await yieldToElectron(120)
    return result
  }

  // AT V1 keeps its public name but reads and writes the internal V2 EQ set.
  const atV1 = await generateStage(0, 'AT V1', 'v2', 'v2')
  const aiwV3 = await generateStage(1, 'AIW V3', 'v3', 'v3')
  const aiwV5 = await generateStage(2, 'AIW V5', 'v5', 'v5')
  return atV1 && aiwV3 && aiwV5 ? { atV1, aiwV3, aiwV5 } : null
}

export function getV5Readiness() {
  return {
    presetLibrary: findV5Library() !== null,
    measurementsLibrary: findMeasurementsLibrary() !== null,
    targetsLibrary: findTargetsLibrary() !== null,
    plugins: Object.fromEntries(Object.entries(PLUGIN_PATHS).map(([key, file]) => [key, fs.existsSync(file)])),
  }
}
