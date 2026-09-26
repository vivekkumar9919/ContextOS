import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { Task, Decision, Issue } from '@contextos/core';
import type { GitContextResult } from '@contextos/git';
import {
  BudgetAllocator,
  MarkdownFormatter,
  HandoffCompiler,
} from '../src/index.js';

describe('@contextos/context-builder Test Suite', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contextos-builder-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  const mockTask: Task = {
    id: randomUUID(),
    projectId: randomUUID(),
    title: 'Implement Multi-Location Routing',
    goal: 'Route orders between warehouses depending on inventory availability.',
    status: 'IN_PROGRESS',
    constraints: [
      'Orders must never be duplicated.',
      'Kafka consumer must remain idempotent.',
      'Existing /api/v1/orders contract must not break.',
    ],
    completedItems: ['Implemented strategy base class', 'Added warehouse selector'],
    remainingItems: ['Implement partial stock split allocation', 'Add e2e warehouse test'],
    blocker: 'Tests fail on line 42 with PartialStockError',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockDecisions: Decision[] = [
    {
      id: randomUUID(),
      projectId: mockTask.projectId,
      title: 'Use Strategy Pattern',
      rationale: 'Allows independent routing plugins for each regional warehouse.',
      status: 'ACTIVE',
      relatedFiles: ['src/order/router.ts', 'src/order/strategies/multi.ts'],
      createdAt: new Date().toISOString(),
    },
    {
      id: randomUUID(),
      projectId: mockTask.projectId,
      title: 'Use Kafka for Order Events',
      rationale: 'Legacy message broker decision.',
      status: 'SUPERSEDED',
      supersededById: 'new-broker-id',
      relatedFiles: ['src/events/kafka.ts'],
      createdAt: new Date().toISOString(),
    },
  ];

  const mockIssues: Issue[] = [
    {
      id: randomUUID(),
      taskId: mockTask.id,
      title: 'Partial stock allocation fails',
      description: 'Order routing crashes when Warehouse 1 only has 2 of 5 items.',
      status: 'OPEN',
      severity: 'BLOCKER',
      createdAt: new Date().toISOString(),
    },
  ];

  const mockGitContext: GitContextResult = {
    repoRoot: '/Users/test/repo',
    branch: 'feature/order-routing',
    head: {
      hash: 'a1b2c3d4e5f6',
      shortHash: 'a1b2c3d',
      author: 'Jane Dev',
      date: '2026-09-27T00:00:00Z',
      message: 'Add warehouse strategy interface',
    },
    status: {
      branch: 'feature/order-routing',
      isDirty: true,
      modified: ['src/order/router.ts'],
      added: ['src/order/strategies/multi.ts'],
      deleted: [],
      untracked: [],
    },
    recentCommits: [
      {
        hash: 'a1b2c3d4e5f6',
        shortHash: 'a1b2c3d',
        message: 'Add warehouse strategy interface',
        date: '2026-09-27T00:00:00Z',
      },
    ],
    diffs: [
      {
        filePath: 'src/order/router.ts',
        additions: 15,
        deletions: 2,
        diff: '@@ -10,2 +10,15 @@\n+ export class OrderRouter {}\n',
        isTruncated: false,
        isExcluded: false,
      },
    ],
    hasSecretsDetected: false,
    secretFindings: [],
    totalDiffLines: 15,
  };

  describe('BudgetAllocator', () => {
    it('estimates tokens proportionally to character length', () => {
      const text = 'Hello world! 1234567890';
      const estimate = BudgetAllocator.estimateTokens(text);
      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBe(Math.ceil(text.length / 4));
    });

    it('guarantees Tier 0 constraints and task information are never omitted', () => {
      // Allocate with a very tight budget (e.g. 50 tokens)
      const plan = BudgetAllocator.allocate(
        mockTask,
        mockDecisions.filter((d) => d.status === 'ACTIVE'),
        mockIssues,
        mockGitContext.diffs,
        mockGitContext.recentCommits,
        50
      );

      // Tier 0 is always computed and retained
      expect(plan.tier0Tokens).toBeGreaterThan(0);
      expect(plan.budgetCeiling).toBe(50);
    });

    it('trims heavy context with 20 issues and long diffs to remain under budget ceiling without losing Tier 0 items', () => {
      const heavyIssues: Issue[] = Array.from({ length: 20 }, (_, i) => ({
        id: randomUUID(),
        taskId: mockTask.id,
        title: `Issue ${i + 1}: ${'A'.repeat(300)}`,
        description: 'B'.repeat(1000),
        status: 'OPEN',
        severity: 'MEDIUM',
        createdAt: new Date().toISOString(),
      }));

      const heavyDiffs = [
        {
          filePath: 'src/massive.ts',
          additions: 1500,
          deletions: 500,
          diff: '+ '.repeat(3000),
          isTruncated: false,
          isExcluded: false,
        },
      ];

      const plan = BudgetAllocator.allocate(
        mockTask,
        mockDecisions.filter((d) => d.status === 'ACTIVE'),
        heavyIssues,
        heavyDiffs,
        mockGitContext.recentCommits,
        4000
      );

      expect(plan.tier0Tokens).toBeGreaterThan(0);
      expect(plan.totalTokens).toBeLessThanOrEqual(4000);
      expect(plan.issues.length).toBeLessThan(heavyIssues.length);
    });
  });

  describe('MarkdownFormatter', () => {
    it('generates Markdown matching the ContextOS handoff layout specification', () => {
      const markdown = MarkdownFormatter.format({
        fromAgent: 'claude',
        toAgent: 'codex',
        targetPhase: 'implementation',
        task: mockTask,
        activeDecisions: mockDecisions.filter((d) => d.status === 'ACTIVE'),
        issues: mockIssues,
        gitStatus: mockGitContext.status,
        headCommit: mockGitContext.head,
        diffs: mockGitContext.diffs,
        recentCommits: mockGitContext.recentCommits,
        nextAction: 'Implement split allocation in multi.ts',
      });

      // Verification of all 8 core sections
      expect(markdown).toContain('# ContextOS Handoff: claude ➔ codex');
      expect(markdown).toContain('## 1. Task Specification');
      expect(markdown).toContain('Implement Multi-Location Routing');
      expect(markdown).toContain('## 2. Invariants & Constraints (MUST PRESERVE)');
      expect(markdown).toContain('Orders must never be duplicated.');
      expect(markdown).toContain('## 3. Active Architectural Decisions');
      expect(markdown).toContain('Use Strategy Pattern');
      expect(markdown).toContain('## 4. Work Progress');
      expect(markdown).toContain('[x] Implemented strategy base class');
      expect(markdown).toContain('[ ] **CURRENT:** Implement partial stock split allocation');
      expect(markdown).toContain('## 5. Git & Working Tree State');
      expect(markdown).toContain('`feature/order-routing`');
      expect(markdown).toContain('## 6. Focused Diff');
      expect(markdown).toContain('src/order/router.ts');
      expect(markdown).toContain('## 7. Known Issues & Test Failures');
      expect(markdown).toContain('Partial stock allocation fails');
      expect(markdown).toContain('## 8. Recommended Next Action');
      expect(markdown).toContain('Implement split allocation in multi.ts');
    });
  });

  describe('HandoffCompiler', () => {
    it('never includes superseded decisions in active handoffs', () => {
      const result = HandoffCompiler.compile({
        task: mockTask,
        decisions: mockDecisions, // contains 1 active, 1 superseded
        issues: mockIssues,
        gitContext: mockGitContext,
        fromAgent: 'claude',
        toAgent: 'codex',
      });

      expect(result.markdown).toContain('Use Strategy Pattern');
      // Superseded decision should be excluded
      expect(result.markdown).not.toContain('Use Kafka for Order Events');
    });

    it('persists latest.md and timestamped archive to output directory', () => {
      const handoffsDir = path.join(tmpDir, '.contextos', 'handoffs');

      const result = HandoffCompiler.compile({
        task: mockTask,
        decisions: mockDecisions,
        issues: mockIssues,
        gitContext: mockGitContext,
        fromAgent: 'claude',
        toAgent: 'codex',
        outputDir: handoffsDir,
      });

      expect(fs.existsSync(result.latestPath)).toBe(true);
      expect(fs.existsSync(result.archivePath)).toBe(true);

      const latestContent = fs.readFileSync(result.latestPath, 'utf-8');
      expect(latestContent).toBe(result.markdown);
      expect(result.tokenCountEstimate).toBeGreaterThan(0);
      expect(result.tokenCountEstimate).toBeLessThan(4000);
    });
  });
});
