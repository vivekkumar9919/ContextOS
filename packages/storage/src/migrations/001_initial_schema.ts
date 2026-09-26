export const migration001 = {
  id: '001',
  name: 'initial_schema',
  sql: `
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      root_path TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      agent_name TEXT NOT NULL,
      agent_role TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      goal TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('BACKLOG', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED')),
      constraints TEXT NOT NULL DEFAULT '[]',
      completed_items TEXT NOT NULL DEFAULT '[]',
      remaining_items TEXT NOT NULL DEFAULT '[]',
      blocker TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      rationale TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('ACTIVE', 'SUPERSEDED', 'DEPRECATED')),
      superseded_by_id TEXT REFERENCES decisions(id) ON DELETE SET NULL,
      related_files TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL CHECK(status IN ('OPEN', 'RESOLVED', 'WONT_FIX')),
      severity TEXT NOT NULL CHECK(severity IN ('BLOCKER', 'HIGH', 'LOW')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS file_changes (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      change_type TEXT NOT NULL CHECK(change_type IN ('MODIFIED', 'ADDED', 'DELETED')),
      summary TEXT
    );

    CREATE TABLE IF NOT EXISTS handoffs (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
      from_agent TEXT NOT NULL,
      to_agent TEXT NOT NULL,
      target_phase TEXT NOT NULL,
      markdown_payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(project_id, status);
    CREATE INDEX IF NOT EXISTS idx_decisions_active ON decisions(project_id, status);
    CREATE INDEX IF NOT EXISTS idx_issues_task_status ON issues(task_id, status);
    CREATE INDEX IF NOT EXISTS idx_handoffs_created ON handoffs(task_id, created_at DESC);
  `,
};
