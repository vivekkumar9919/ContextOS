import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import {
  type Issue,
  type CreateIssueInput,
  IssueSchema,
} from '@contextos/core';

export class IssueRepository {
  constructor(private readonly db: Database.Database) {}

  public create(input: CreateIssueInput): Issue {
    const id = input.id || randomUUID();
    const createdAt = new Date().toISOString();
    const status = input.status || 'OPEN';
    const severity = input.severity || 'HIGH';

    const stmt = this.db.prepare(`
      INSERT INTO issues (id, task_id, title, description, status, severity, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, input.taskId, input.title, input.description || null, status, severity, createdAt);

    return {
      id,
      taskId: input.taskId,
      title: input.title,
      description: input.description || null,
      status,
      severity,
      createdAt,
    };
  }

  public findById(id: string): Issue | null {
    const row = this.db.prepare('SELECT * FROM issues WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  public listOpenByTask(taskId: string): Issue[] {
    const rows = this.db.prepare(`
      SELECT * FROM issues
      WHERE task_id = ? AND status = 'OPEN'
      ORDER BY created_at DESC
    `).all(taskId) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  public resolve(id: string): boolean {
    const result = this.db.prepare("UPDATE issues SET status = 'RESOLVED' WHERE id = ?").run(id);
    return result.changes > 0;
  }

  public delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM issues WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private mapRow(row: any): Issue {
    return IssueSchema.parse({
      id: row.id,
      taskId: row.task_id,
      title: row.title,
      description: row.description,
      status: row.status,
      severity: row.severity,
      createdAt: row.created_at,
    });
  }
}
