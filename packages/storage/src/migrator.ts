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

export interface MigrationTransferResult {
  projects: number;
  tasks: number;
  decisions: number;
  issues: number;
  handoffs: number;
}

export function migrateDatabase(sourceDb: Database.Database, targetDb: Database.Database): MigrationTransferResult {
  const counts: MigrationTransferResult = { projects: 0, tasks: 0, decisions: 0, issues: 0, handoffs: 0 };

  // 1. Projects
  try {
    const projects = sourceDb.prepare('SELECT * FROM projects').all() as any[];
    const insertProj = targetDb.prepare(`
      INSERT OR IGNORE INTO projects (id, name, root_path, created_at)
      VALUES (?, ?, ?, ?)
    `);
    for (const p of projects) {
      const res = insertProj.run(p.id, p.name, p.root_path, p.created_at);
      if (res.changes > 0) counts.projects++;
    }
  } catch {
    // ignore
  }

  // 2. Tasks
  try {
    const tasks = sourceDb.prepare('SELECT * FROM tasks').all() as any[];
    const insertTask = targetDb.prepare(`
      INSERT OR REPLACE INTO tasks (
        id, project_id, title, goal, status,
        constraints, completed_items, remaining_items,
        blocker, jira_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const t of tasks) {
      const res = insertTask.run(
        t.id,
        t.project_id,
        t.title,
        t.goal,
        t.status,
        t.constraints,
        t.completed_items,
        t.remaining_items,
        t.blocker,
        t.jira_id || null,
        t.created_at,
        t.updated_at
      );
      if (res.changes > 0) counts.tasks++;
    }
  } catch {
    // ignore
  }

  // 3. Decisions
  try {
    const decisions = sourceDb.prepare('SELECT * FROM decisions').all() as any[];
    const insertDec = targetDb.prepare(`
      INSERT OR REPLACE INTO decisions (
        id, project_id, title, rationale, status,
        related_files, superseded_by_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const d of decisions) {
      const res = insertDec.run(
        d.id,
        d.project_id,
        d.title,
        d.rationale,
        d.status,
        d.related_files,
        d.superseded_by_id,
        d.created_at,
        d.updated_at
      );
      if (res.changes > 0) counts.decisions++;
    }
  } catch {
    // ignore
  }

  // 4. Issues
  try {
    const issues = sourceDb.prepare('SELECT * FROM issues').all() as any[];
    const insertIssue = targetDb.prepare(`
      INSERT OR REPLACE INTO issues (id, task_id, title, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const i of issues) {
      const res = insertIssue.run(i.id, i.task_id, i.title, i.status, i.created_at, i.updated_at);
      if (res.changes > 0) counts.issues++;
    }
  } catch {
    // ignore
  }

  // 5. Handoffs
  try {
    const handoffs = sourceDb.prepare('SELECT * FROM handoffs').all() as any[];
    const insertHandoff = targetDb.prepare(`
      INSERT OR REPLACE INTO handoffs (id, task_id, from_agent, to_agent, target_phase, markdown_payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const h of handoffs) {
      const res = insertHandoff.run(
        h.id,
        h.task_id,
        h.from_agent,
        h.to_agent,
        h.target_phase,
        h.markdown_payload,
        h.created_at
      );
      if (res.changes > 0) counts.handoffs++;
    }
  } catch {
    // ignore
  }

  return counts;
}
