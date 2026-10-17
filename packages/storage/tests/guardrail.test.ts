import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  createDatabaseConnection,
  GuardrailRepository,
  BypassPolicyRepository,
} from '../src/index.js';

describe('Guardrails and Bypass Policies Engine', () => {
  let db: Database.Database;
  let guardrailRepo: GuardrailRepository;
  let policyRepo: BypassPolicyRepository;

  beforeEach(() => {
    db = createDatabaseConnection({ inMemory: true });
    guardrailRepo = new GuardrailRepository(db);
    policyRepo = new BypassPolicyRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('BypassPolicyRepository', () => {
    it('seeds the 4 default bypass policies on initialization', () => {
      const policies = policyRepo.listAll();
      const ids = policies.map((p) => p.id);
      expect(ids).toContain('p-never');
      expect(ids).toContain('p-human-only');
      expect(ids).toContain('p-trusted-agents');
      expect(ids).toContain('p-permissive');

      const trusted = policyRepo.findById('p-trusted-agents');
      expect(trusted?.policyType).toBe('SPECIFIC_AGENTS');
      expect(trusted?.allowedAgents).toContain('claude');
      expect(trusted?.allowedAgents).toContain('antigravity');
    });

    it('creates, updates, and deletes custom policies', () => {
      const custom = policyRepo.create({
        id: 'p-custom-leads',
        name: 'Tech Leads Only',
        policyType: 'SPECIFIC_AGENTS',
        allowedAgents: ['lead-architect', 'reviewer'],
      });
      expect(custom.id).toBe('p-custom-leads');

      const updated = policyRepo.update('p-custom-leads', {
        allowedAgents: ['lead-architect', 'reviewer', 'claude'],
      });
      expect(updated?.allowedAgents).toContain('claude');

      const deleted = policyRepo.delete('p-custom-leads');
      expect(deleted).toBe(true);
      expect(policyRepo.findById('p-custom-leads')).toBeNull();
    });
  });

  describe('GuardrailRepository', () => {
    it('creates and lists local and global guardrails', () => {
      const g1 = guardrailRepo.create({
        projectId: 'proj-1',
        title: 'No Force Push',
        rule: 'Never execute git push --force on main',
        type: 'ACTION_BLOCK',
        severity: 'BLOCKER',
        scope: 'GLOBAL',
        pattern: 'git\\s+push.*--force',
        policyId: 'p-human-only',
        remediation: 'Use git revert instead of force pushing',
      });
      expect(g1.id).toBeDefined();

      const g2 = guardrailRepo.create({
        projectId: 'proj-1',
        title: 'Sanitize SQL Queries',
        rule: 'Always use parameterized SQL queries',
        type: 'INVARIANT',
        severity: 'BLOCKER',
        scope: 'LOCAL',
        policyId: 'p-trusted-agents',
      });
      expect(g2.id).toBeDefined();

      const all = guardrailRepo.findByProject('proj-1');
      expect(all.length).toBe(2);

      const globals = guardrailRepo.listAll({ scope: 'GLOBAL' });
      expect(globals.length).toBe(1);
      expect(globals[0].title).toBe('No Force Push');
    });

    it('enforces ACTION_BLOCK on matching destructive commands', () => {
      guardrailRepo.create({
        projectId: 'proj-1',
        title: 'No Force Push',
        rule: 'Never force push',
        type: 'ACTION_BLOCK',
        severity: 'BLOCKER',
        scope: 'LOCAL',
        pattern: 'git\\s+push.*--force',
        policyId: 'p-human-only',
        remediation: 'Create a revert commit',
      });

      // Attempt command without bypass
      const res1 = guardrailRepo.checkGuardrails({
        command: 'git push origin main --force',
        agentName: 'codex',
        projectId: 'proj-1',
      });
      expect(res1.allowed).toBe(false);
      expect(res1.violations.length).toBe(1);
      expect(res1.violations[0].remediation).toBe('Create a revert commit');

      // Attempt with non-matching safe command
      const res2 = guardrailRepo.checkGuardrails({
        command: 'git status',
        agentName: 'codex',
        projectId: 'proj-1',
      });
      expect(res2.allowed).toBe(true);
      expect(res2.violations.length).toBe(0);
    });

    it('enforces HUMAN_ONLY policy: agent cannot bypass, human can bypass with reason', () => {
      guardrailRepo.create({
        projectId: 'proj-1',
        title: 'No Force Push',
        rule: 'Never force push',
        type: 'ACTION_BLOCK',
        severity: 'BLOCKER',
        scope: 'LOCAL',
        pattern: 'git\\s+push.*--force',
        policyId: 'p-human-only',
      });

      // AI agent tries to bypass -> REJECTED
      const agentRes = guardrailRepo.checkGuardrails({
        command: 'git push origin main --force',
        agentName: 'codex',
        bypassReason: 'User told me to push',
        isHuman: false,
        projectId: 'proj-1',
      });
      expect(agentRes.allowed).toBe(false);
      expect(agentRes.violations[0].bypassed).toBe(false);

      // Human in terminal bypasses -> ALLOWED
      const humanRes = guardrailRepo.checkGuardrails({
        command: 'git push origin main --force',
        agentName: 'human',
        bypassReason: 'Emergency release hotfix',
        isHuman: true,
        projectId: 'proj-1',
      });
      expect(humanRes.allowed).toBe(true);
      expect(humanRes.violations[0].bypassed).toBe(true);
    });

    it('enforces SPECIFIC_AGENTS policy: trusted agent can bypass, untrusted agent blocked', () => {
      guardrailRepo.create({
        projectId: 'proj-1',
        title: 'Prisma Migration Check',
        rule: 'Migrations require generated client',
        type: 'ACTION_BLOCK',
        severity: 'BLOCKER',
        scope: 'LOCAL',
        pattern: 'prisma\\s+migrate\\s+--skip-generate',
        policyId: 'p-trusted-agents', // allowed: claude, antigravity
      });

      // Codex (untrusted) tries to bypass -> REJECTED
      const codexRes = guardrailRepo.checkGuardrails({
        command: 'npx prisma migrate --skip-generate',
        agentName: 'codex',
        bypassReason: 'Need quick test',
        projectId: 'proj-1',
      });
      expect(codexRes.allowed).toBe(false);
      expect(codexRes.violations[0].bypassed).toBe(false);

      // Claude (trusted) tries to bypass with reason -> ALLOWED
      const claudeRes = guardrailRepo.checkGuardrails({
        command: 'npx prisma migrate --skip-generate',
        agentName: 'claude',
        bypassReason: 'Schema generation tested in previous step',
        projectId: 'proj-1',
      });
      expect(claudeRes.allowed).toBe(true);
      expect(claudeRes.violations[0].bypassed).toBe(true);
    });

    it('enforces NEVER policy: cannot be bypassed by anyone', () => {
      guardrailRepo.create({
        projectId: 'proj-1',
        title: 'Secret Protection',
        rule: 'Never modify .env or credentials',
        type: 'ACTION_BLOCK',
        severity: 'BLOCKER',
        scope: 'LOCAL',
        pattern: '\\.env.*',
        policyId: 'p-never',
      });

      const res = guardrailRepo.checkGuardrails({
        files: ['.env.production'],
        agentName: 'claude',
        isHuman: true,
        bypassReason: 'Critical emergency production override',
        projectId: 'proj-1',
      });
      expect(res.allowed).toBe(false);
      expect(res.violations[0].bypassed).toBe(false);
    });

    it('enforces VERIFICATION_GATE on task completion', () => {
      guardrailRepo.create({
        projectId: 'proj-1',
        title: 'Unit Tests',
        rule: 'Vitest tests must pass before completion',
        type: 'VERIFICATION_GATE',
        severity: 'BLOCKER',
        scope: 'LOCAL',
        policyId: 'p-permissive',
      });

      // Attempt complete task without bypass
      const check1 = guardrailRepo.checkGuardrails({
        action: 'COMPLETE_TASK',
        agentName: 'codex',
        projectId: 'proj-1',
      });
      expect(check1.allowed).toBe(false);

      // Attempt complete task with bypass reason
      const check2 = guardrailRepo.checkGuardrails({
        action: 'COMPLETE_TASK',
        agentName: 'codex',
        bypassReason: 'Tests verified manually in CLI terminal',
        projectId: 'proj-1',
      });
      expect(check2.allowed).toBe(true);
      expect(check2.violations[0].bypassed).toBe(true);
    });
  });
});
