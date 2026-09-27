import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { runMigrations } from './migrator.js';

let defaultInstance: Database.Database | null = null;

export function resolveDbDir(projectRoot?: string): string {
  if (process.env.CONTEXTOS_HOME) {
    return process.env.CONTEXTOS_HOME;
  }
  if (projectRoot && fs.existsSync(path.join(projectRoot, '.contextos', 'context.db'))) {
    return path.join(projectRoot, '.contextos');
  }
  if (fs.existsSync(path.join(process.cwd(), '.contextos', 'context.db'))) {
    return path.join(process.cwd(), '.contextos');
  }
  return path.join(os.homedir(), '.contextos');
}

export function getDbPath(projectRoot?: string): string {
  const dir = resolveDbDir(projectRoot);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, 'context.db');
}

export interface DatabaseOptions {
  inMemory?: boolean;
  dbPath?: string;
  projectRoot?: string;
  timeout?: number;
}

export function createDatabaseConnection(options: DatabaseOptions = {}): Database.Database {
  const { inMemory = false, dbPath, projectRoot, timeout = 5000 } = options;

  let targetPath = ':memory:';
  if (!inMemory) {
    targetPath = dbPath || getDbPath(projectRoot);
  }

  const db = new Database(targetPath, { timeout });

  if (!inMemory) {
    db.pragma('journal_mode = WAL');
  }
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  runMigrations(db);

  return db;
}

export function getDatabase(projectRoot?: string): Database.Database {
  if (defaultInstance) {
    return defaultInstance;
  }
  defaultInstance = createDatabaseConnection({ projectRoot });
  return defaultInstance;
}

export function closeDatabase(): void {
  if (defaultInstance) {
    defaultInstance.close();
    defaultInstance = null;
  }
}
