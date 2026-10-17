export const migration003 = {
  id: '003',
  name: 'add_guardrails',
  sql: `
    CREATE TABLE IF NOT EXISTS bypass_policies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      policy_type TEXT NOT NULL CHECK(policy_type IN ('NEVER', 'HUMAN_ONLY', 'SPECIFIC_AGENTS', 'ANY_AGENT')),
      allowed_agents TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS guardrails (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      rule TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('INVARIANT', 'ACTION_BLOCK', 'VERIFICATION_GATE')),
      severity TEXT NOT NULL CHECK(severity IN ('BLOCKER', 'WARNING', 'INFO')),
      scope TEXT NOT NULL CHECK(scope IN ('GLOBAL', 'LOCAL')),
      pattern TEXT,
      remediation TEXT,
      policy_id TEXT NOT NULL REFERENCES bypass_policies(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_guardrails_project ON guardrails(project_id, scope);
    CREATE INDEX IF NOT EXISTS idx_guardrails_type ON guardrails(type, severity);

    INSERT OR IGNORE INTO bypass_policies (id, name, description, policy_type, allowed_agents)
    VALUES
      ('p-never', 'Strict Invariant', 'Zero bypasses permitted under any circumstances', 'NEVER', '[]'),
      ('p-human-only', 'Human Approval Required', 'AI agents cannot self-exempt. Human confirmation required via terminal', 'HUMAN_ONLY', '[]'),
      ('p-trusted-agents', 'Senior Agent Override', 'Trusted lead models can bypass with documented user reason', 'SPECIFIC_AGENTS', '["claude","antigravity"]'),
      ('p-permissive', 'Standard Review', 'Any agent can bypass if explicitly requested by user', 'ANY_AGENT', '["*"]');
  `,
};
