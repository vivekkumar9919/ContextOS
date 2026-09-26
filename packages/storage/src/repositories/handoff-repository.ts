import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import {
  type Handoff,
  type CreateHandoffInput,
  HandoffSchema,
} from '@contextos/core';

export class HandoffRepository {
  constructor(private readonly db: Database.Database) {}

  public create(input: CreateHandoffInput): Handoff {
    const id = input.id || randomUUID();
    const createdAt = new Date().toISOString();
    const targetPhase = input.targetPhase || 'implementation';

    const stmt = this.db.prepare(`
      INSERT INTO handoffs (id, task_id, session_id, from_agent, to_agent, target_phase, markdown_payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.taskId,
      input.sessionId || null,
      input.fromAgent,
      input.toAgent,
      targetPhase,
      input.markdownPayload,
      createdAt
    );

    return {
      id,
      taskId: input.taskId,
      sessionId: input.sessionId || null,
      fromAgent: input.fromAgent,
      toAgent: input.toAgent,
      targetPhase,
      markdownPayload: input.markdownPayload,
      createdAt,
    };
  }

  public findLatestByTask(taskId: string): Handoff | null {
    const row = this.db.prepare(`
      SELECT * FROM handoffs
      WHERE task_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(taskId) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  public listByTask(taskId: string): Handoff[] {
    const rows = this.db.prepare(`
      SELECT * FROM handoffs
      WHERE task_id = ?
      ORDER BY created_at DESC
    `).all(taskId) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  private mapRow(row: any): Handoff {
    return HandoffSchema.parse({
      id: row.id,
      taskId: row.task_id,
      sessionId: row.session_id,
      fromAgent: row.from_agent,
      toAgent: row.to_agent,
      targetPhase: row.target_phase,
      markdownPayload: row.markdown_payload,
      createdAt: row.created_at,
    });
  }
}
