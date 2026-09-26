import type { Task, Decision, Issue, HandoffPhase } from '@contextos/core';
import type { GitStatusResult, HeadCommit, FilteredFileDiff, GitCommitSummary } from '@contextos/git';

export interface FormatHandoffOptions {
  fromAgent: string;
  toAgent: string;
  targetPhase: HandoffPhase;
  task: Task;
  activeDecisions: Decision[];
  issues: Issue[];
  gitStatus: GitStatusResult;
  headCommit: HeadCommit | null;
  diffs: FilteredFileDiff[];
  recentCommits: GitCommitSummary[];
  nextAction?: string;
  timestamp?: string;
}

export class MarkdownFormatter {
  public static format(options: FormatHandoffOptions): string {
    const {
      fromAgent,
      toAgent,
      targetPhase,
      task,
      activeDecisions,
      issues,
      gitStatus,
      headCommit,
      diffs,
      recentCommits,
      nextAction,
      timestamp = new Date().toISOString(),
    } = options;

    const phaseTitle = targetPhase.charAt(0).toUpperCase() + targetPhase.slice(1);
    const sections: string[] = [];

    // Header & Meta
    sections.push(
      `# ContextOS Handoff: ${fromAgent} ➔ ${toAgent}\n` +
      `**Generated:** ${timestamp}  \n` +
      `**Phase:** ${phaseTitle} Phase  \n\n---`
    );

    // 1. Task Specification
    sections.push(
      `## 1. Task Specification\n` +
      `- **Task:** ${task.title}\n` +
      `- **Goal:** ${task.goal}\n` +
      `- **Status:** ${task.status}\n` +
      `- **Current Blocker:** ${task.blocker || 'None'}`
    );

    // 2. Invariants & Constraints
    const constraintsList =
      task.constraints && task.constraints.length > 0
        ? task.constraints.map((c: string) => `- ${c}`).join('\n')
        : '- *No active constraints specified.*';
    sections.push(`## 2. Invariants & Constraints (MUST PRESERVE)\n${constraintsList}`);

    // 3. Active Architectural Decisions
    let decisionsContent = '- *No active architectural decisions recorded.*';
    if (activeDecisions.length > 0) {
      decisionsContent = activeDecisions
        .map((d) => {
          const files = d.relatedFiles && d.relatedFiles.length > 0
            ? `\n  - *Related Files:* \`${d.relatedFiles.join('`, `')}\``
            : '';
          return `- **${d.title}**: ${d.rationale}${files}`;
        })
        .join('\n');
    }
    sections.push(`## 3. Active Architectural Decisions\n${decisionsContent}`);

    // 4. Work Progress
    const progressLines: string[] = [];
    if (task.completedItems && task.completedItems.length > 0) {
      for (const item of task.completedItems) {
        progressLines.push(`- [x] ${item}`);
      }
    }
    if (task.remainingItems && task.remainingItems.length > 0) {
      task.remainingItems.forEach((item: string, index: number) => {
        if (index === 0) {
          progressLines.push(`- [ ] **CURRENT:** ${item}`);
        } else {
          progressLines.push(`- [ ] ${item}`);
        }
      });
    }
    if (progressLines.length === 0) {
      progressLines.push('- *No checklist items defined.*');
    }
    sections.push(`## 4. Work Progress\n${progressLines.join('\n')}`);

    // 5. Git & Working Tree State
    const headInfo = headCommit
      ? `\`${headCommit.shortHash}\` (${headCommit.message})`
      : 'Unknown';
    const modifiedFilesList = [
      ...gitStatus.modified.map((f: string) => `  - \`${f}\` (Modified)`),
      ...gitStatus.added.map((f: string) => `  - \`${f}\` (Added)`),
      ...gitStatus.deleted.map((f: string) => `  - \`${f}\` (Deleted)`),
    ];
    const touchedContent =
      modifiedFilesList.length > 0
        ? `\n- **Modified Files:**\n${modifiedFilesList.join('\n')}`
        : '\n- **Modified Files:** Clean working tree';

    sections.push(
      `## 5. Git & Working Tree State\n` +
      `- **Branch:** \`${gitStatus.branch}\`\n` +
      `- **HEAD:** ${headInfo}${touchedContent}`
    );

    // 6. Focused Diff
    let diffsContent = '```diff\n# No active code diffs in working tree.\n```';
    if (diffs.length > 0) {
      const diffBlocks = diffs
        .map((d) => `### ${d.filePath}\n\`\`\`diff\n${d.diff.trim()}\n\`\`\``)
        .join('\n\n');
      diffsContent = diffBlocks;
    }
    sections.push(`## 6. Focused Diff\n${diffsContent}`);

    // 7. Known Issues & Test Failures
    let issuesContent = '- *No open blockers or issues reported.*';
    if (issues.length > 0) {
      issuesContent = issues
        .map((i) => {
          const desc = i.description ? `: ${i.description}` : '';
          return `- **${i.title}** ([${i.severity}])${desc}`;
        })
        .join('\n');
    }
    sections.push(`## 7. Known Issues & Test Failures\n${issuesContent}`);

    // 8. Recommended Next Action
    const defaultNextAction =
      task.remainingItems && task.remainingItems.length > 0
        ? `Proceed with implementation of: **${task.remainingItems[0]}**`
        : 'Continue development or review according to task specification.';
    sections.push(`## 8. Recommended Next Action\n${nextAction || defaultNextAction}`);

    return sections.join('\n\n') + '\n';
  }
}
