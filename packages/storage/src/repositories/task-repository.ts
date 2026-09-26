import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import {
  type Task,
  type CreateTaskInput,
  type UpdateTaskInput,
  TaskSchema,
  EntityNotFoundError,
} from '@contextos/core';

export class TaskRepository {
  constructor(private readonly db: Database.Database) {}

  public create(input: CreateTaskInput): Task {
    const id = input.id || randomUUID();
    const now = new Date().toISOString();
    const constraints = JSON.stringify(input.constraints || []);
    const completedItems = JSON.stringify(input.completedItems || []);
    const remainingItems = JSON.stringify(input.remainingItems || []);
    const status = input.status || 'IN_PROGRESS';

    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, project_id, title, goal, status,
        constraints, completed_items, remaining_items,
        blocker, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.projectId,
      input.title,
      input.goal,
      status,
      constraints,
      completedItems,
      remainingItems,
      input.blocker || null,
      now,
      now
    );

    return {
      id,
      projectId: input.projectId,
      title: input.title,
      goal: input.goal,
      status,
      constraints: input.constraints || [],
      completedItems: input.completedItems || [],
      remainingItems: input.remainingItems || [],
      blocker: input.blocker || null,
      createdAt: now,
      updatedAt: now,
    };
  }

  public findById(id: string): Task | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  public findActiveByProject(projectId: string): Task | null {
    const row = this.db.prepare(`
      SELECT * FROM tasks
      WHERE project_id = ? AND status IN ('IN_PROGRESS', 'BLOCKED')
      ORDER BY updated_at DESC
      LIMIT 1
    `).get(projectId) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  public listByProject(projectId: string): Task[] {
    const rows = this.db.prepare(`
      SELECT * FROM tasks
      WHERE project_id = ?
      ORDER BY updated_at DESC
    `).all(projectId) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  public update(id: string, input: UpdateTaskInput): Task {
    const existing = this.findById(id);
    if (!existing) {
      throw new EntityNotFoundError('Task', id);
    }

    const now = new Date().toISOString();

    let constraints = input.constraints ?? existing.constraints;
    if (input.addConstraints && input.addConstraints.length > 0) {
      constraints = Array.from(new Set([...constraints, ...input.addConstraints]));
    }

    let completedItems = input.completedItems ?? existing.completedItems;
    if (input.addCompletedItems && input.addCompletedItems.length > 0) {
      completedItems = Array.from(new Set([...completedItems, ...input.addCompletedItems]));
    }

    let remainingItems = input.remainingItems ?? existing.remainingItems;
    if (input.addRemainingItems && input.addRemainingItems.length > 0) {
      remainingItems = Array.from(new Set([...remainingItems, ...input.addRemainingItems]));
    }

    remainingItems = remainingItems.filter((item) => !completedItems.includes(item));

    const updated: Task = {
      ...existing,
      title: input.title ?? existing.title,
      goal: input.goal ?? existing.goal,
      status: input.status ?? existing.status,
      constraints,
      completedItems,
      remainingItems,
      blocker: input.blocker !== undefined ? input.blocker : existing.blocker,
      updatedAt: now,
    };

    const stmt = this.db.prepare(`
      UPDATE tasks
      SET title = ?, goal = ?, status = ?,
          constraints = ?, completed_items = ?, remaining_items = ?,
          blocker = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      updated.title,
      updated.goal,
      updated.status,
      JSON.stringify(updated.constraints),
      JSON.stringify(updated.completedItems),
      JSON.stringify(updated.remainingItems),
      updated.blocker,
      updated.updatedAt,
      id
    );

    return updated;
  }

  public delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private mapRow(row: any): Task {
    return TaskSchema.parse({
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      goal: row.goal,
      status: row.status,
      constraints: JSON.parse(row.constraints || '[]'),
      completedItems: JSON.parse(row.completed_items || '[]'),
      remainingItems: JSON.parse(row.remaining_items || '[]'),
      blocker: row.blocker,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
