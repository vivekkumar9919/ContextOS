import { getCliContext } from '../context.js';
import { logSuccess, logError, logInfo, colors } from '../ui.js';
import type { TaskStatus } from '@contextos/core';

export interface TaskCommandOptions {
  subcommand?: string;
  id?: string;
  jira?: string;
  title?: string;
  goal?: string;
  status?: string;
  blocker?: string;
  clearBlocker?: boolean;
  constraints?: string;
  remaining?: string;
  item?: string;
}

export function handleTask(options: TaskCommandOptions): void {
  const ctx = getCliContext();
  const sub = options.subcommand || 'list';

  switch (sub) {
    case 'help': {
      console.log(`\n${colors.bold('ContextOS Task Subcommands & Options:')}\n`);
      console.log(`  ${colors.green('contextos task create')} --title <t> --goal <g> [--jira <ticket>] [--constraints <c>] [--remaining <r>]`);
      console.log(`      Creates a new active task with optional Jira ticket (e.g. --jira PROJ-123).\n`);
      console.log(`  ${colors.green('contextos task get')} [--jira <ticket> | --id <id>]`);
      console.log(`      Retrieves the complete context, constraints, and checklist for a Jira ticket or task.\n`);
      console.log(`  ${colors.green('contextos task update')} [--jira <ticket>] [--status <s>] [--blocker <b>] [--clear-blocker]`);
      console.log(`      Updates task status, associates/updates Jira ticket, or updates blockers.\n`);
      console.log(`  ${colors.green('contextos task complete')} [--item <checklist_item>] [--jira <ticket>]`);
      console.log(`      Completes an individual checklist item or marks the entire task as COMPLETED.\n`);
      console.log(`  ${colors.green('contextos task clear')} [--jira <ticket>]`);
      console.log(`      Clears active blockers on the task.\n`);
      console.log(`  ${colors.green('contextos task list')}`);
      console.log(`      Lists all recorded tasks for this project with status and Jira tags.\n`);
      break;
    }

    case 'create': {
      if (!options.title || !options.goal) {
        logError('Task creation requires both --title and --goal flags.');
        console.log(`Example: ${colors.dim('contextos task create --title "Auth Feature" --goal "JWT Auth" --jira PROJ-123')}`);
        return;
      }

      const constraints = options.constraints
        ? options.constraints.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      const remainingItems = options.remaining
        ? options.remaining.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      const jiraId = options.jira ? options.jira.trim().toUpperCase() : undefined;

      const task = ctx.taskRepo.create({
        projectId: ctx.project.id,
        title: options.title,
        goal: options.goal,
        status: 'IN_PROGRESS',
        constraints,
        completedItems: [],
        remainingItems,
        jiraId,
      });

      logSuccess(`Task created: ${colors.bold(task.title)} [ID: ${task.id}]`);
      if (task.jiraId) console.log(`  Jira:   ${colors.cyan(task.jiraId)}`);
      console.log(`  Goal:   ${task.goal}`);
      console.log(`  Status: ${colors.green(task.status)}`);
      break;
    }

    case 'update': {
      const targetTask = options.jira
        ? ctx.taskRepo.findByJiraId(ctx.project.id, options.jira)
        : options.id
        ? ctx.taskRepo.findById(options.id)
        : ctx.activeTask;

      if (!targetTask) {
        logError(
          options.jira
            ? `No task found with Jira ID: ${options.jira}`
            : 'No active task found to update. Specify --id <task_id> or --jira <ticket>.'
        );
        return;
      }

      const validStatuses: TaskStatus[] = ['BACKLOG', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'];
      if (options.status && !validStatuses.includes(options.status as TaskStatus)) {
        logError(`Invalid status '${options.status}'. Valid: ${validStatuses.join(', ')}`);
        return;
      }

      const updated = ctx.taskRepo.update(targetTask.id, {
        title: options.title,
        goal: options.goal,
        status: options.status as TaskStatus,
        blocker: options.clearBlocker ? null : options.blocker,
        jiraId: options.jira ? options.jira.trim().toUpperCase() : undefined,
      });

      logSuccess(`Task updated: ${colors.bold(updated.title)}`);
      if (updated.jiraId) console.log(`  Jira:    ${colors.cyan(updated.jiraId)}`);
      console.log(`  Status:  ${colors.cyan(updated.status)}`);
      if (updated.blocker) console.log(`  Blocker: ${colors.red(updated.blocker)}`);
      break;
    }

    case 'get': {
      const targetTask = options.jira
        ? ctx.taskRepo.findByJiraId(ctx.project.id, options.jira)
        : options.id
        ? ctx.taskRepo.findById(options.id)
        : ctx.activeTask;

      if (!targetTask) {
        logError(
          options.jira
            ? `No task found with Jira ID: ${options.jira}`
            : options.id
            ? `No task found with ID: ${options.id}`
            : 'No active task found.'
        );
        return;
      }

      console.log(`\n${colors.bold('--- Task Context ---')}`);
      console.log(`  Title:       ${colors.bold(targetTask.title)}`);
      if (targetTask.jiraId) console.log(`  Jira Ticket: ${colors.cyan(targetTask.jiraId)}`);
      console.log(`  Status:      ${colors.green(targetTask.status)}`);
      console.log(`  Goal:        ${targetTask.goal}`);
      if (targetTask.blocker) console.log(`  Blocker:     ${colors.red(targetTask.blocker)}`);

      if (targetTask.constraints && targetTask.constraints.length > 0) {
        console.log(`  Invariants/Constraints:`);
        for (const c of targetTask.constraints) console.log(`    • ${c}`);
      }
      if (targetTask.completedItems && targetTask.completedItems.length > 0) {
        console.log(`  Completed Checklist:`);
        for (const c of targetTask.completedItems) console.log(`    ${colors.green('✔')} ${c}`);
      }
      if (targetTask.remainingItems && targetTask.remainingItems.length > 0) {
        console.log(`  Remaining Checklist:`);
        for (const r of targetTask.remainingItems) console.log(`    ○ ${r}`);
      }
      console.log('');
      break;
    }

    case 'complete': {
      const targetTask = options.jira
        ? ctx.taskRepo.findByJiraId(ctx.project.id, options.jira)
        : options.id
        ? ctx.taskRepo.findById(options.id)
        : ctx.activeTask;

      if (!targetTask) {
        logError('No active task to complete. Specify --id <task_id> or --jira <ticket>.');
        return;
      }

      if (options.item) {
        // Complete an individual checklist item
        const updated = ctx.taskRepo.update(targetTask.id, {
          addCompletedItems: [options.item],
        });
        logSuccess(`Checklist item completed: "${options.item}"`);
        console.log(`  Progress: ${updated.completedItems.length} completed, ${updated.remainingItems.length} remaining.`);
      } else {
        // Complete the entire task
        const updated = ctx.taskRepo.update(targetTask.id, {
          status: 'COMPLETED',
          blocker: null,
        });
        logSuccess(`Task completed: ${colors.bold(updated.title)}!`);
      }
      break;
    }

    case 'clear': {
      const targetTask = options.jira
        ? ctx.taskRepo.findByJiraId(ctx.project.id, options.jira)
        : options.id
        ? ctx.taskRepo.findById(options.id)
        : ctx.activeTask;

      if (!targetTask) {
        logInfo('No active task found to clear.');
        return;
      }

      ctx.taskRepo.update(targetTask.id, {
        blocker: null,
      });
      logSuccess(`Cleared blockers on task: ${colors.bold(targetTask.title)}`);
      break;
    }

    case 'list':
    default: {
      const tasks = ctx.taskRepo.listByProject(ctx.project.id);
      if (tasks.length === 0) {
        logInfo('No tasks recorded yet for this project.');
        console.log(`Create your first task with: ${colors.dim('contextos task create --title "Feature" --goal "Description"')}`);
        return;
      }

      console.log(`\n${colors.bold('Tasks for Project:')} ${colors.cyan(ctx.projectName)}\n`);
      for (const t of tasks) {
        const isCurrent = ctx.activeTask?.id === t.id ? colors.green(' [ACTIVE]') : '';
        const jiraTag = t.jiraId ? ` [${colors.cyan(t.jiraId)}]` : '';
        console.log(`• ${colors.bold(t.title)}${jiraTag} (${t.status})${isCurrent}`);
        console.log(`  ID:   ${colors.dim(t.id)}`);
        console.log(`  Goal: ${t.goal}`);
        if (t.blocker) console.log(`  ${colors.red('Blocker:')} ${t.blocker}`);
        console.log('');
      }
      break;
    }
  }
}
