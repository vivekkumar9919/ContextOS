import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { BypassPolicy, BypassPolicyType } from '@contextos/core';

export class BypassPolicyRepository {
  constructor(private readonly db: Database.Database) {}

  public create(input: {
    id?: string;
    name: string;
    description?: string;
    policyType: BypassPolicyType;
    allowedAgents?: string[];
  }): BypassPolicy {
    const id = input.id || `p-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const allowedAgents = JSON.stringify(input.allowedAgents || []);

    const stmt = this.db.prepare(`
      INSERT INTO bypass_policies (id, name, description, policy_type, allowed_agents, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, input.name, input.description || null, input.policyType, allowedAgents, now, now);

    return {
      id,
      name: input.name,
      description: input.description,
      policyType: input.policyType,
      allowedAgents: input.allowedAgents || [],
      createdAt: now,
      updatedAt: now,
    };
  }

  public findById(id: string): BypassPolicy | null {
    const row = this.db.prepare('SELECT * FROM bypass_policies WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  public listAll(): BypassPolicy[] {
    const rows = this.db.prepare('SELECT * FROM bypass_policies ORDER BY created_at ASC').all() as any[];
    return rows.map((r) => this.mapRow(r));
  }

  public update(
    id: string,
    updates: {
      name?: string;
      description?: string;
      policyType?: BypassPolicyType;
      allowedAgents?: string[];
    }
  ): BypassPolicy | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const name = updates.name !== undefined ? updates.name : existing.name;
    const description = updates.description !== undefined ? updates.description : existing.description;
    const policyType = updates.policyType !== undefined ? updates.policyType : existing.policyType;
    const allowedAgents =
      updates.allowedAgents !== undefined ? updates.allowedAgents : existing.allowedAgents;
    const now = new Date().toISOString();

    this.db
      .prepare(`
        UPDATE bypass_policies
        SET name = ?, description = ?, policy_type = ?, allowed_agents = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(name, description || null, policyType, JSON.stringify(allowedAgents), now, id);

    return {
      id,
      name,
      description,
      policyType,
      allowedAgents,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
  }

  public delete(id: string): boolean {
    const res = this.db.prepare('DELETE FROM bypass_policies WHERE id = ?').run(id);
    return res.changes > 0;
  }

  private mapRow(row: any): BypassPolicy {
    let allowedAgents: string[] = [];
    try {
      allowedAgents = JSON.parse(row.allowed_agents || '[]');
    } catch {
      allowedAgents = [];
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      policyType: row.policy_type as BypassPolicyType,
      allowedAgents,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

