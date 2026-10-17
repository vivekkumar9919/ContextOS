import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type {
  Guardrail,
  CreateGuardrailInput,
  UpdateGuardrailInput,
  GuardrailType,
  GuardrailSeverity,
  GuardrailScope,
  GuardrailViolation,
  GuardrailCheckResult,
} from '@contextos/core';
import { BypassPolicyRepository } from './bypass-policy-repository.js';

export class GuardrailRepository {
  private readonly policyRepo: BypassPolicyRepository;

  constructor(private readonly db: Database.Database) {
    this.policyRepo = new BypassPolicyRepository(db);
  }

  public create(input: CreateGuardrailInput): Guardrail {
    const id = input.id || `g-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const type = input.type || 'INVARIANT';
    const severity = input.severity || 'BLOCKER';
    const scope = input.scope || 'LOCAL';
    const policyId = input.policyId || 'p-human-only';
    const projectId = input.projectId || '';

    const stmt = this.db.prepare(`
      INSERT INTO guardrails (
        id, project_id, title, rule, type, severity, scope, pattern, remediation, policy_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      projectId,
      input.title,
      input.rule,
      type,
      severity,
      scope,
      input.pattern || null,
      input.remediation || null,
      policyId,
      now,
      now
    );

    return {
      id,
      projectId,
      title: input.title,
      rule: input.rule,
      type,
      severity,
      scope,
      pattern: input.pattern,
      remediation: input.remediation,
      policyId,
      createdAt: now,
      updatedAt: now,
    };
  }

  public findById(id: string): Guardrail | null {
    const row = this.db.prepare('SELECT * FROM guardrails WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  public findByProject(projectId: string, includeGlobal = true): Guardrail[] {
    let sql = 'SELECT * FROM guardrails WHERE project_id = ?';
    const params: any[] = [projectId];

    if (includeGlobal) {
      sql += " OR scope = 'GLOBAL'";
    }
    sql += ' ORDER BY created_at ASC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  public listAll(options: { projectId?: string; scope?: GuardrailScope; type?: GuardrailType } = {}): Guardrail[] {
    let sql = 'SELECT * FROM guardrails WHERE 1=1';
    const params: any[] = [];

    if (options.projectId !== undefined) {
      sql += ' AND (project_id = ? OR scope = "GLOBAL")';
      params.push(options.projectId);
    }
    if (options.scope) {
      sql += ' AND scope = ?';
      params.push(options.scope);
    }
    if (options.type) {
      sql += ' AND type = ?';
      params.push(options.type);
    }

    sql += ' ORDER BY created_at ASC';
    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  public update(id: string, updates: UpdateGuardrailInput): Guardrail | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const title = updates.title !== undefined ? updates.title : existing.title;
    const rule = updates.rule !== undefined ? updates.rule : existing.rule;
    const type = updates.type !== undefined ? updates.type : existing.type;
    const severity = updates.severity !== undefined ? updates.severity : existing.severity;
    const pattern = updates.pattern !== undefined ? updates.pattern : existing.pattern;
    const remediation = updates.remediation !== undefined ? updates.remediation : existing.remediation;
    const policyId = updates.policyId !== undefined ? updates.policyId : existing.policyId;
    const now = new Date().toISOString();

    this.db
      .prepare(`
        UPDATE guardrails
        SET title = ?, rule = ?, type = ?, severity = ?, pattern = ?, remediation = ?, policy_id = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(title, rule, type, severity, pattern || null, remediation || null, policyId, now, id);

    return {
      id,
      projectId: existing.projectId,
      title,
      rule,
      type,
      severity,
      scope: existing.scope,
      pattern,
      remediation,
      policyId,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
  }

  public delete(id: string): boolean {
    const res = this.db.prepare('DELETE FROM guardrails WHERE id = ?').run(id);
    return res.changes > 0;
  }

  public checkGuardrails(options: {
    command?: string;
    files?: string[];
    action?: string;
    agentName?: string;
    bypassReason?: string;
    isHuman?: boolean;
    projectId?: string;
    globalRepo?: GuardrailRepository;
  }): GuardrailCheckResult {
    const localGuardrails = this.findByProject(options.projectId || '', true);
    let allGuardrails = [...localGuardrails];

    if (options.globalRepo && options.globalRepo !== this) {
      const globalGuardrails = options.globalRepo.listAll({ scope: 'GLOBAL' });
      const existingIds = new Set(allGuardrails.map((g) => g.id));
      for (const gg of globalGuardrails) {
        if (!existingIds.has(gg.id)) {
          allGuardrails.push(gg);
        }
      }
    }

    const violations: GuardrailViolation[] = [];
    const agentName = (options.agentName || 'unknown').toLowerCase();
    const isHuman = options.isHuman === true;
    const hasBypassReason = Boolean(options.bypassReason && options.bypassReason.trim().length > 0);

    for (const guardrail of allGuardrails) {
      let isTriggered = false;
      let triggerMessage = '';

      if (guardrail.type === 'ACTION_BLOCK') {
        if (options.command) {
          if (guardrail.pattern) {
            try {
              const regex = new RegExp(guardrail.pattern, 'i');
              if (regex.test(options.command)) {
                isTriggered = true;
                triggerMessage = `Command '${options.command}' matches blocked pattern '${guardrail.pattern}'`;
              }
            } catch {
              if (options.command.toLowerCase().includes(guardrail.pattern.toLowerCase())) {
                isTriggered = true;
                triggerMessage = `Command contains blocked pattern '${guardrail.pattern}'`;
              }
            }
          } else {
            // General destructive commands if rule mentions force/destructive
            const destructive = /(git\s+push.*--force|git\s+reset\s+--hard|rm\s+-rf\s+\/|drop\s+database)/i;
            if (destructive.test(options.command)) {
              isTriggered = true;
              triggerMessage = `Command '${options.command}' matches destructive action block`;
            }
          }
        }

        if (!isTriggered && options.files && options.files.length > 0) {
          if (guardrail.pattern) {
            try {
              const regex = new RegExp(guardrail.pattern, 'i');
              for (const file of options.files) {
                if (regex.test(file)) {
                  isTriggered = true;
                  triggerMessage = `File '${file}' matches protected pattern '${guardrail.pattern}'`;
                  break;
                }
              }
            } catch {
              for (const file of options.files) {
                if (file.toLowerCase().includes(guardrail.pattern.toLowerCase())) {
                  isTriggered = true;
                  triggerMessage = `File '${file}' matches protected pattern '${guardrail.pattern}'`;
                  break;
                }
              }
            }
          }
        }
      } else if (guardrail.type === 'VERIFICATION_GATE') {
        if (options.action === 'COMPLETE_TASK') {
          isTriggered = true;
          triggerMessage = `Task completion requires passing verification gate: ${guardrail.rule}`;
        }
      }

      if (isTriggered) {
        // Evaluate policy
        const policy = this.policyRepo.findById(guardrail.policyId) || {
          id: guardrail.policyId,
          name: 'Fallback',
          policyType: 'HUMAN_ONLY' as const,
          allowedAgents: [],
          createdAt: '',
          updatedAt: '',
        };

        let canBypass = false;
        let bypassMsg = '';

        if (policy.policyType === 'NEVER') {
          canBypass = false;
          bypassMsg = `Rule policy is 'NEVER'. No bypass is permitted under any circumstances.`;
        } else if (policy.policyType === 'HUMAN_ONLY') {
          if (isHuman && hasBypassReason) {
            canBypass = true;
          } else {
            canBypass = false;
            bypassMsg = `Rule policy is 'HUMAN_ONLY'. Autonomous AI agents cannot self-bypass. Human CLI approval required.`;
          }
        } else if (policy.policyType === 'SPECIFIC_AGENTS') {
          if (isHuman && hasBypassReason) {
            canBypass = true;
          } else if (hasBypassReason && policy.allowedAgents.map((a) => a.toLowerCase()).includes(agentName)) {
            canBypass = true;
          } else {
            canBypass = false;
            bypassMsg = `Agent '${options.agentName || 'unknown'}' is not authorized to bypass this rule. Authorized agents: [${policy.allowedAgents.join(', ')}].`;
          }
        } else if (policy.policyType === 'ANY_AGENT') {
          if (hasBypassReason) {
            canBypass = true;
          } else {
            canBypass = false;
            bypassMsg = `Bypass reason required to bypass this rule.`;
          }
        }

        const violation: GuardrailViolation = {
          guardrailId: guardrail.id,
          title: guardrail.title,
          rule: guardrail.rule,
          type: guardrail.type,
          severity: guardrail.severity,
          policyId: policy.id,
          policyType: policy.policyType,
          message: canBypass ? `${triggerMessage} (Bypassed: ${options.bypassReason})` : `${triggerMessage}. ${bypassMsg}`,
          remediation: guardrail.remediation,
          bypassed: canBypass,
          bypassReason: canBypass ? options.bypassReason : undefined,
          authorizedBy: canBypass ? (isHuman ? 'human' : agentName) : undefined,
        };

        violations.push(violation);
      }
    }

    const unbypassedBlockers = violations.filter((v) => v.severity === 'BLOCKER' && !v.bypassed);
    const allowed = unbypassedBlockers.length === 0;
    const bypassed = violations.some((v) => v.bypassed);

    let summary = 'All guardrails passed.';
    if (!allowed) {
      summary = `Action blocked by ${unbypassedBlockers.length} guardrail(s).`;
    } else if (bypassed) {
      summary = `Action permitted with ${violations.filter((v) => v.bypassed).length} bypassed rule(s).`;
    }

    return {
      allowed,
      violations,
      bypassed,
      summary,
    };
  }

  private mapRow(row: any): Guardrail {
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      rule: row.rule,
      type: row.type as GuardrailType,
      severity: row.severity as GuardrailSeverity,
      scope: row.scope as GuardrailScope,
      pattern: row.pattern || undefined,
      remediation: row.remediation || undefined,
      policyId: row.policy_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

