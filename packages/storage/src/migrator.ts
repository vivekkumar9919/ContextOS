import type Database from 'better-sqlite3';
import { migration001 } from './migrations/001_initial_schema.js';
import { migration002 } from './migrations/002_add_jira_id.js';

export interface Migration {
  id: string;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [migration001, migration002];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const appliedRows = db.prepare('SELECT id FROM _migrations').all() as { id: string }[];
  const appliedIds = new Set(appliedRows.map((r) => r.id));

  for (const migration of MIGRATIONS) {
    if (!appliedIds.has(migration.id)) {
      const applyTransaction = db.transaction(() => {
        db.exec(migration.sql);
        db.prepare('INSERT INTO _migrations (id, name) VALUES (?, ?)').run(
          migration.id,
          migration.name
        );
      });
      applyTransaction();
    }
  }
}
