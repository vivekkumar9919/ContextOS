import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { HandoffCompiler } from '@contextos/context-builder';
import { createDatabaseConnection, TaskRepository } from '@contextos/storage';
import type { HandoffPhase, Task } from '@contextos/core';
import { getCliContext } from '../context.js';
import { copyToClipboard } from '../clipboard.js';
import { logSuccess, logInfo, logWarning, colors } from '../ui.js';

export interface HandoffCommandOptions {
  from?: string;
  to?: string;
  phase?: string;
  noCopy?: boolean;
  jira?: string;
  global?: boolean;
}

export function handleHandoff(options: HandoffCommandOptions): void {
  const ctx = getCliContext({ forceGlobal: Boolean(options.global) });

  const fromAgent = options.from || 'developer';
  const toAgent = options.to || 'assistant';
  const targetPhase: HandoffPhase =
    (options.phase as HandoffPhase) || 'implementation';

  // Find active task or task by Jira ID, or check cross-database fallback
  let task = options.jira
    ? ctx.taskRepo.findByJiraId(ctx.project.id, options.jira)
    : ctx.activeTask;

  const globalDbPath = path.join(os.homedir(), '.contextos', 'context.db');
  if (!task && options.jira && ctx.dbPath !== globalDbPath && fs.existsSync(globalDbPath)) {
    try {
      const globalDb = createDatabaseConnection({ dbPath: globalDbPath });
      const globalTaskRepo = new TaskRepository(globalDb);
      const found = globalTaskRepo.findByJiraId('', options.jira);
      if (found) {
        task = found;
        logInfo(`Loaded task for Jira ticket ${colors.cyan(options.jira.toUpperCase())} from global storage.`);
      }
    } catch {
      // ignore
    }
  }

  if (!task) {
    const taskTitle = options.jira
      ? `${options.jira.toUpperCase()} Implementation`
      : `${ctx.projectName} Development`;
    const taskGoal = options.jira
      ? `Execution of Jira ticket ${options.jira.toUpperCase()}`
      : 'General workspace development and code review.';

    logWarning(`No active task found. Creating workspace handoff task for ${taskTitle}.`);
    task = ctx.taskRepo.create({
      projectId: ctx.project.id,
      title: taskTitle,
      goal: taskGoal,
      status: 'IN_PROGRESS',
      constraints: [],
      completedItems: [],
      remainingItems: [],
      jiraId: options.jira ? options.jira.toUpperCase() : undefined,
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
