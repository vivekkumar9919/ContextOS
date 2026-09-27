export const migration002 = {
  id: '002',
  name: 'add_jira_id',
  sql: `
    ALTER TABLE tasks ADD COLUMN jira_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_tasks_jira_id ON tasks(project_id, jira_id);
  `,
};
