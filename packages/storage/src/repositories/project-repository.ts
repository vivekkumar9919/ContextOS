import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import {
  type Project,
  type CreateProjectInput,
  ProjectSchema,
} from '@contextos/core';

export class ProjectRepository {
  constructor(private readonly db: Database.Database) {}

  public create(input: CreateProjectInput): Project {
    const id = input.id || randomUUID();
    const createdAt = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, root_path, created_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(id, input.name, input.rootPath, createdAt);
    return {
      id,
      name: input.name,
      rootPath: input.rootPath,
      createdAt,
    };
  }

  public findById(id: string): Project | null {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  public findByRootPath(rootPath: string): Project | null {
    const row = this.db.prepare('SELECT * FROM projects WHERE root_path = ?').get(rootPath) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  public findOrCreate(name: string, rootPath: string): Project {
    const existing = this.findByRootPath(rootPath);
    if (existing) return existing;
    return this.create({ name, rootPath });
  }

  public list(): Project[] {
    const rows = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as any[];
    return rows.map((r) => this.mapRow(r));
  }

  public delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private mapRow(row: any): Project {
    return ProjectSchema.parse({
      id: row.id,
      name: row.name,
      rootPath: row.root_path,
      createdAt: row.created_at,
    });
  }
}
