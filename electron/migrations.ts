import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { EQUALIZER_APO_CONFIG } from './astral-paths'

interface MigrationState {
  schemaVersion: number
  lastAppVersion: string
  completed: string[]
}

interface MigrationContext {
  backupManagedPath: (relativePath: string) => string | null
  removeManagedPath: (relativePath: string) => void
  writeManagedFile: (relativePath: string, content: string) => void
  rollback: () => void
}

interface Migration {
  id: string
  schemaVersion: number
  run: (context: MigrationContext) => Promise<void> | void
}

const migrations: Migration[] = [
  {
    id: '001-initialize-managed-schema',
    schemaVersion: 1,
    run: () => undefined,
  },
]

function getMigrationRoot(): string {
  return path.join(process.env.PROGRAMDATA || app.getPath('userData'), 'AstralAudio')
}

function resolveManagedPath(relativePath: string): string {
  const root = path.resolve(EQUALIZER_APO_CONFIG)
  const target = path.resolve(root, relativePath)
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error(`Unsafe migration path: ${relativePath}`)
  return target
}

function readState(stateFile: string): MigrationState {
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile, 'utf8')) as Partial<MigrationState>
    return {
      schemaVersion: Number(parsed.schemaVersion) || 0,
      lastAppVersion: parsed.lastAppVersion || '0.0.0',
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
    }
  } catch {
    return { schemaVersion: 0, lastAppVersion: '0.0.0', completed: [] }
  }
}

function writeState(stateFile: string, state: MigrationState) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true })
  const temporaryFile = `${stateFile}.tmp`
  fs.writeFileSync(temporaryFile, JSON.stringify(state, null, 2), 'utf8')
  fs.renameSync(temporaryFile, stateFile)
}

function createContext(backupRoot: string): MigrationContext {
  const backups = new Map<string, string | null>()
  const backupManagedPath = (relativePath: string): string | null => {
    if (backups.has(relativePath)) return backups.get(relativePath) ?? null
    const source = resolveManagedPath(relativePath)
    if (!fs.existsSync(source)) {
      backups.set(relativePath, null)
      return null
    }
    const destination = path.join(backupRoot, relativePath)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.cpSync(source, destination, { recursive: true, force: true })
    backups.set(relativePath, destination)
    return destination
  }

  return {
    backupManagedPath,
    removeManagedPath: relativePath => {
      const target = resolveManagedPath(relativePath)
      backupManagedPath(relativePath)
      if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true })
    },
    writeManagedFile: (relativePath, content) => {
      const target = resolveManagedPath(relativePath)
      backupManagedPath(relativePath)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      const temporaryFile = `${target}.astral-migration.tmp`
      fs.writeFileSync(temporaryFile, content, 'utf8')
      fs.renameSync(temporaryFile, target)
    },
    rollback: () => {
      for (const [relativePath, backup] of [...backups.entries()].reverse()) {
        const target = resolveManagedPath(relativePath)
        if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true })
        if (backup && fs.existsSync(backup)) {
          fs.mkdirSync(path.dirname(target), { recursive: true })
          fs.cpSync(backup, target, { recursive: true, force: true })
        }
      }
    },
  }
}

export async function runPendingMigrations(onProgress?: (message: string) => void): Promise<{ success: boolean; migrated: boolean; error?: string }> {
  const migrationRoot = getMigrationRoot()
  const stateFile = path.join(migrationRoot, 'migration-state.json')
  const state = readState(stateFile)
  const pending = migrations.filter(migration => !state.completed.includes(migration.id))

  try {
    for (const migration of pending) {
      onProgress?.(`Aplicando migración ${migration.schemaVersion}…`)
      const backupRoot = path.join(migrationRoot, 'backups', `${new Date().toISOString().replaceAll(':', '-')}-${migration.id}`)
      const context = createContext(backupRoot)
      try {
        await migration.run(context)
      } catch (error) {
        context.rollback()
        throw error
      }
      state.completed.push(migration.id)
      state.schemaVersion = Math.max(state.schemaVersion, migration.schemaVersion)
      state.lastAppVersion = app.getVersion()
      writeState(stateFile, state)
    }
    if (!pending.length && state.lastAppVersion !== app.getVersion()) {
      state.lastAppVersion = app.getVersion()
      writeState(stateFile, state)
    }
    return { success: true, migrated: pending.length > 0 }
  } catch (error) {
    return { success: false, migrated: pending.length > 0, error: error instanceof Error ? error.message : String(error) }
  }
}
