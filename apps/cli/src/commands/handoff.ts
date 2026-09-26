import * as path from 'node:path';
import { HandoffCompiler } from '@contextos/context-builder';
import type { HandoffPhase, Task } from '@contextos/core';
import { getCliContext } from '../context.js';
import { copyToClipboard } from '../clipboard.js';
import { logSuccess, logInfo, logWarning, colors } from '../ui.js';

export interface HandoffCommandOptions {
  from?: string;
  to?: string;
  phase?: string;
  noCopy?: boolean;
}

export function handleHandoff(options: HandoffCommandOptions): void {
  const ctx = getCliContext();

  const fromAgent = options.from || 'developer';
  const toAgent = options.to || 'assistant';
  const targetPhase: HandoffPhase =
    (options.phase as HandoffPhase) || 'implementation';

  // Find active task or create default fallback
  let task = ctx.activeTask;
  if (!task) {
    logWarning('No active task found. Creating temporary workspace handoff task.');
    task = ctx.taskRepo.create({
      projectId: ctx.project.id,
      title: `${ctx.projectName} Development`,
      goal: 'General workspace development and code review.',
      status: 'IN_PROGRESS',
      constraints: [],
      completedItems: [],
      remainingItems: [],
    });
  }

  const activeDecisions = ctx.decisionRepo.listActiveByProject(ctx.project.id);
  const openIssues = ctx.issueRepo.listOpenByTask(task.id);
  const gitContext = ctx.gitClient.getFilteredContext({ maxTotalLines: 1000 });

  const handoffsDir = path.join(ctx.projectRoot, '.contextos', 'handoffs');

  const result = HandoffCompiler.compile({
    task,
    decisions: activeDecisions,
    issues: openIssues,
    gitContext,
    fromAgent,
    toAgent,
    targetPhase,
    outputDir: handoffsDir,
  });

  // Record in SQLite
  ctx.handoffRepo.create({
    taskId: task.id,
    fromAgent,
    toAgent,
    targetPhase,
    markdownPayload: result.markdown,
  });

  logSuccess(`Handoff compiled successfully!`);
  console.log(`  ${colors.bold('Flow:')}        ${fromAgent} ➔ ${toAgent}`);
  console.log(`  ${colors.bold('Phase:')}       ${targetPhase}`);
  console.log(`  ${colors.bold('Tokens:')}      ~${result.tokenCountEstimate} tokens (${result.markdown.length} bytes)`);
  console.log(`  ${colors.bold('File:')}        ${colors.dim(result.latestPath)}`);
  console.log(`  ${colors.bold('Archive:')}     ${colors.dim(result.archivePath)}`);

  if (!options.noCopy) {
    const copied = copyToClipboard(result.markdown);
    if (copied) {
      logSuccess(`${colors.bold('Copied to system clipboard!')} Ready to paste into AI chat.`);
    } else {
      logInfo(`Clipboard utility not found. You can copy the content directly from: ${colors.dim(result.latestPath)}`);
    }
  }
}
