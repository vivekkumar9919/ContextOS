import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Task, Decision, Issue, HandoffPhase } from '@contextos/core';
import type { GitContextResult } from '@contextos/git';
import { BudgetAllocator } from './budget-allocator.js';
import { MarkdownFormatter } from './markdown-formatter.js';

export interface CompileHandoffInput {
  task: Task;
  decisions: Decision[];
  issues: Issue[];
  gitContext: GitContextResult;
  fromAgent: string;
  toAgent: string;
  targetPhase?: HandoffPhase;
  nextAction?: string;
  tokenBudget?: number;
  outputDir?: string;
}

export interface CompileHandoffResult {
  markdown: string;
  tokenCountEstimate: number;
  latestPath: string;
  archivePath: string;
}

export class HandoffCompiler {
  public static compile(input: CompileHandoffInput): CompileHandoffResult {
    const {
      task,
      decisions,
      issues,
      gitContext,
      fromAgent,
      toAgent,
      targetPhase = 'implementation',
      nextAction,
      tokenBudget = BudgetAllocator.DEFAULT_BUDGET,
      outputDir,
    } = input;

    // Invariant: Never include superseded or deprecated decisions under active handoffs
    const activeDecisions = decisions.filter((d) => d.status === 'ACTIVE');

    // 1. Allocate budget across tiers
    const plan = BudgetAllocator.allocate(
      task,
      activeDecisions,
      issues.filter((i) => i.status === 'OPEN'),
      gitContext.diffs,
      gitContext.recentCommits,
      tokenBudget
    );

    // 2. Format Markdown
    const now = new Date();
    const isoTimestamp = now.toISOString();
    const markdown = MarkdownFormatter.format({
      fromAgent,
      toAgent,
      targetPhase,
      task: {
        ...task,
        completedItems: plan.completedItems,
      },
      activeDecisions: plan.decisions,
      issues: plan.issues,
      gitStatus: gitContext.status,
      headCommit: gitContext.head,
      diffs: plan.diffs,
      recentCommits: plan.commits,
      nextAction,
      timestamp: isoTimestamp,
    });

    const tokenCountEstimate = BudgetAllocator.estimateTokens(markdown);

    // 3. Write to Disk if outputDir is provided
    let latestPath = '';
    let archivePath = '';

    if (outputDir) {
      const handoffsDir = path.resolve(outputDir);
      const archiveDir = path.join(handoffsDir, 'archive');

      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }

      latestPath = path.join(handoffsDir, 'latest.md');
      fs.writeFileSync(latestPath, markdown, 'utf-8');

      // Timestamp for filename: YYYY-MM-DDTHH-mm-ss
      const safeTime = isoTimestamp.replace(/:/g, '-').replace(/\..+/, '');
      const archiveFileName = `${safeTime}_${fromAgent}_to_${toAgent}.md`;
      archivePath = path.join(archiveDir, archiveFileName);
      fs.writeFileSync(archivePath, markdown, 'utf-8');
    }

    return {
      markdown,
      tokenCountEstimate,
      latestPath,
      archivePath,
    };
  }
}
