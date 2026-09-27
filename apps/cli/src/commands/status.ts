import { getCliContext } from '../context.js';
import { colors, banner } from '../ui.js';

export function handleStatus(): void {
  const ctx = getCliContext();
  const gitContext = ctx.gitClient.getFilteredContext({ maxTotalLines: 10 });

  console.log(banner());
  console.log(colors.bold('--- Project Overview ---'));
  console.log(`  Project: ${colors.cyan(ctx.projectName)}`);
  console.log(`  Root:    ${colors.dim(ctx.projectRoot)}`);
  console.log(`  DB:      ${colors.dim(ctx.dbPath)}`);

  console.log(`\n${colors.bold('--- Git Working Tree ---')}`);
  console.log(`  Branch:  ${colors.green(gitContext.branch)}`);
  const headStr = gitContext.head
    ? `${gitContext.head.shortHash} ("${gitContext.head.message}")`
    : 'None';
  console.log(`  HEAD:    ${colors.dim(headStr)}`);
  console.log(`  Dirty:   ${gitContext.status.isDirty ? colors.yellow('Yes') : colors.green('No (Clean)')}`);

  if (gitContext.status.modified.length > 0) {
    console.log(`  Modified: ${gitContext.status.modified.map((f: string) => colors.yellow(f)).join(', ')}`);
  }
  if (gitContext.status.added.length > 0) {
    console.log(`  Added:    ${gitContext.status.added.map((f: string) => colors.green(f)).join(', ')}`);
  }

  console.log(`\n${colors.bold('--- Active Task ---')}`);
  if (ctx.activeTask) {
    const statusColor =
      ctx.activeTask.status === 'IN_PROGRESS'
        ? colors.green
        : ctx.activeTask.status === 'BLOCKED'
        ? colors.red
        : colors.yellow;

    console.log(`  Title:   ${colors.bold(ctx.activeTask.title)}`);
    if (ctx.activeTask.jiraId) {
      console.log(`  Jira:    ${colors.cyan(ctx.activeTask.jiraId)}`);
    }
    console.log(`  Status:  ${statusColor(ctx.activeTask.status)}`);
    console.log(`  Goal:    ${ctx.activeTask.goal}`);

    if (ctx.activeTask.blocker) {
      console.log(`  Blocker: ${colors.red(ctx.activeTask.blocker)}`);
    }

    if (ctx.activeTask.constraints && ctx.activeTask.constraints.length > 0) {
      console.log(`  Invariants/Constraints:`);
      for (const c of ctx.activeTask.constraints) {
        console.log(`    - ${c}`);
      }
    }

    if (ctx.activeTask.completedItems && ctx.activeTask.completedItems.length > 0) {
      console.log(`  Completed:`);
      for (const c of ctx.activeTask.completedItems) {
        console.log(`    ${colors.green('✔')} ${c}`);
      }
    }

    if (ctx.activeTask.remainingItems && ctx.activeTask.remainingItems.length > 0) {
      console.log(`  Remaining:`);
      for (const r of ctx.activeTask.remainingItems) {
        console.log(`    ${colors.dim('○')} ${r}`);
      }
    }
  } else {
    console.log(`  ${colors.dim('No active task found. Use `contextos task create` to start one.')}`);
  }

  const activeDecisions = ctx.decisionRepo.listActiveByProject(ctx.project.id);
  console.log(`\n${colors.bold('--- Active Architectural Decisions ---')}`);
  if (activeDecisions.length > 0) {
    for (const d of activeDecisions) {
      console.log(`  • ${colors.bold(d.title)}: ${d.rationale}`);
    }
  } else {
    console.log(`  ${colors.dim('No architectural decisions recorded.')}`);
  }
  console.log('');
}
