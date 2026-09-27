import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import {
  type Decision,
  type CreateDecisionInput,
  DecisionSchema,
  EntityNotFoundError,
  CycleDetectedError,
} from '@contextos/core';

export class DecisionRepository {
  constructor(private readonly db: Database.Database) {}

  public create(input: CreateDecisionInput): Decision {
    const id = input.id || randomUUID();
    const createdAt = new Date().toISOString();
    const relatedFiles = JSON.stringify(input.relatedFiles || []);
    const status = input.status || 'ACTIVE';

    if (input.supersededById) {
      this.checkCycle(id, input.supersededById);
    }

    const stmt = this.db.prepare(`
      INSERT INTO decisions (id, project_id, title, rationale, status, superseded_by_id, related_files, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.projectId,
      input.title,
      input.rationale,
      status,
      input.supersededById || null,
      relatedFiles,
      createdAt
    );

    return {
      id,
      projectId: input.projectId,
      title: input.title,
      rationale: input.rationale,
      status,
      supersededById: input.supersededById || null,
      relatedFiles: input.relatedFiles || [],
      createdAt,
    };
  }

  public findById(id: string): Decision | null {
    const row = this.db.prepare('SELECT * FROM decisions WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  public listActiveByProject(projectId: string): Decision[] {
    const rows = this.db.prepare(`
      SELECT * FROM decisions
      WHERE project_id = ? AND status = 'ACTIVE'
      ORDER BY created_at DESC
    `).all(projectId) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  public listAllByProject(projectId: string): Decision[] {
    const rows = this.db.prepare(`
      SELECT * FROM decisions
      WHERE project_id = ?
      ORDER BY created_at DESC
    `).all(projectId) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  public listAll(options?: { status?: string; limit?: number }): Decision[] {
    let sql = 'SELECT * FROM decisions';
    const params: any[] = [];
    if (options?.status) {
      sql += ' WHERE status = ?';
      params.push(options.status);
    }
    sql += ' ORDER BY created_at DESC';
    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  public supersede(oldId: string, newId: string): void {
    const oldDecision = this.findById(oldId);
    if (!oldDecision) {
      throw new EntityNotFoundError('Decision', oldId);
    }

    const newDecision = this.findById(newId);
    if (!newDecision) {
      throw new EntityNotFoundError('Decision', newId);
    }

    this.checkCycle(oldId, newId);

    const transaction = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE decisions
        SET status = 'SUPERSEDED', superseded_by_id = ?
        WHERE id = ?
      `).run(newId, oldId);

      this.db.prepare(`
        UPDATE decisions
        SET status = 'ACTIVE'
        WHERE id = ?
      `).run(newId);
    });

    transaction();
  }

  public delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM decisions WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private checkCycle(ancestorId: string, descendantId: string): void {
    if (ancestorId === descendantId) {
      throw new CycleDetectedError(ancestorId, descendantId);
    }

    let curr: string | null = descendantId;
    const visited = new Set<string>();

    while (curr) {
      if (curr === ancestorId) {
        throw new CycleDetectedError(ancestorId, descendantId);
      }
      if (visited.has(curr)) {
        break;
      }
      visited.add(curr);

      const parentRow = this.db.prepare('SELECT superseded_by_id FROM decisions WHERE id = ?').get(curr) as any;
      curr = parentRow?.superseded_by_id || null;
    }
  }

  private mapRow(row: any): Decision {
    return DecisionSchema.parse({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      rationale: row.rationale,
      status: row.status,
      supersededById: row.superseded_by_id,
      relatedFiles: JSON.parse(row.related_files || '[]'),
      createdAt: row.created_at,
    });
  }
}
