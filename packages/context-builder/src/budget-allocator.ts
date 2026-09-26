import type { Task, Decision, Issue } from '@contextos/core';
import type { FilteredFileDiff, GitCommitSummary } from '@contextos/git';

export interface BudgetAllocationPlan {
  tier0Tokens: number;
  tier1Tokens: number;
  tier2Tokens: number;
  tier3Tokens: number;
  totalTokens: number;
  budgetCeiling: number;
  decisions: Decision[];
  issues: Issue[];
  diffs: FilteredFileDiff[];
  commits: GitCommitSummary[];
  completedItems: string[];
}

export class BudgetAllocator {
  public static readonly DEFAULT_BUDGET = 4000; // ~16 KB Markdown

  public static estimateTokens(text: string): number {
    if (!text) return 0;
    // Standard rule-of-thumb: 1 token ≈ 4 characters for English prose and code
    return Math.ceil(text.length / 4);
  }

  public static allocate(
    task: Task,
    activeDecisions: Decision[],
    openIssues: Issue[],
    fileDiffs: FilteredFileDiff[],
    recentCommits: GitCommitSummary[],
    maxTokens: number = BudgetAllocator.DEFAULT_BUDGET
  ): BudgetAllocationPlan {
    let remainingBudget = maxTokens;

    // --- Tier 0: Mandatory Core (100% Guaranteed) ---
    // Task goal, title, status, constraints, blocker, recommended next action
    const tier0Text = [
      task.title,
      task.goal,
      task.status,
      ...(task.constraints || []),
      task.blocker || '',
    ].join('\n');
    const tier0Tokens = this.estimateTokens(tier0Text);
    remainingBudget = Math.max(0, remainingBudget - tier0Tokens);

    // --- Tier 1: High Relevance (Active Decisions on Touched Files + Open Issues) ---
    const budgetedDecisions: Decision[] = [];
    let tier1Tokens = 0;

    for (const dec of activeDecisions) {
      const decText = `${dec.title}\n${dec.rationale}\n${(dec.relatedFiles || []).join(' ')}`;
      const tokens = this.estimateTokens(decText);
      if (remainingBudget >= tokens) {
        budgetedDecisions.push(dec);
        tier1Tokens += tokens;
        remainingBudget -= tokens;
      }
    }

    const budgetedIssues: Issue[] = [];
    for (const issue of openIssues) {
      const issueText = `${issue.title}\n${issue.description || ''}\n${issue.severity}`;
      const tokens = this.estimateTokens(issueText);
      if (remainingBudget >= tokens) {
        budgetedIssues.push(issue);
        tier1Tokens += tokens;
        remainingBudget -= tokens;
      }
    }

    // --- Tier 2: Code Reality (Filtered Git Diffs) ---
    const budgetedDiffs: FilteredFileDiff[] = [];
    let tier2Tokens = 0;

    for (const diff of fileDiffs) {
      const tokens = this.estimateTokens(diff.diff);
      if (remainingBudget >= tokens) {
        budgetedDiffs.push(diff);
        tier2Tokens += tokens;
        remainingBudget -= tokens;
      } else if (remainingBudget >= 50) {
        // Can fit truncated diff header strictly within remaining budget
        const truncationNotice = '\n... [Remaining diff lines omitted: Token budget limit reached]';
        const noticeTokens = this.estimateTokens(truncationNotice);
        const availableBudgetTokens = Math.max(0, remainingBudget - noticeTokens);
        const availableChars = availableBudgetTokens * 4;

        let partial = diff.diff.slice(0, availableChars);
        const lastNewline = partial.lastIndexOf('\n');
        if (lastNewline > 40) {
          partial = partial.slice(0, lastNewline);
        }

        const formattedDiff = `${partial}${truncationNotice}`;
        const partialTokens = this.estimateTokens(formattedDiff);

        budgetedDiffs.push({
          ...diff,
          diff: formattedDiff,
          isTruncated: true,
        });
        tier2Tokens += partialTokens;
        remainingBudget = Math.max(0, remainingBudget - partialTokens);
        break;
      } else {
        // Budget exhausted, include only statistical summary
        budgetedDiffs.push({
          ...diff,
          diff: `[Diff omitted: Token budget reached (+${diff.additions}, -${diff.deletions} lines)]`,
          isTruncated: true,
        });
      }
    }

    // --- Tier 3: Context Enrichers (Recent Commits & Completed Items) ---
    const budgetedCommits: GitCommitSummary[] = [];
    let tier3Tokens = 0;

    for (const commit of recentCommits) {
      const commitText = `${commit.hash} ${commit.message} ${commit.date}`;
      const tokens = this.estimateTokens(commitText);
      if (remainingBudget >= tokens) {
        budgetedCommits.push(commit);
        tier3Tokens += tokens;
        remainingBudget -= tokens;
      }
    }

    const budgetedCompletedItems: string[] = [];
    for (const item of task.completedItems || []) {
      const tokens = this.estimateTokens(item);
      if (remainingBudget >= tokens) {
        budgetedCompletedItems.push(item);
        tier3Tokens += tokens;
        remainingBudget -= tokens;
      }
    }

    const totalTokens = tier0Tokens + tier1Tokens + tier2Tokens + tier3Tokens;

    return {
      tier0Tokens,
      tier1Tokens,
      tier2Tokens,
      tier3Tokens,
      totalTokens,
      budgetCeiling: maxTokens,
      decisions: budgetedDecisions,
      issues: budgetedIssues,
      diffs: budgetedDiffs,
      commits: budgetedCommits,
      completedItems: budgetedCompletedItems,
    };
  }
}
