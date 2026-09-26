import { getCliContext } from '../context.js';
import { logSuccess, logError, logInfo, colors } from '../ui.js';
import type { TaskStatus } from '@contextos/core';

export interface TaskCommandOptions {
  subcommand?: string;
  id?: string;
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
    case 'create': {
      if (!options.title || !options.goal) {
        logError('Task creation requires both --title and --goal flags.');
        console.log(`Example: ${colors.dim('contextos task create --title "Auth Feature" --goal "JWT Auth"')}`);
        return;
      }

      const constraints = options.constraints
        ? options.constraints.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      const remainingItems = options.remaining
        ? options.remaining.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      const task = ctx.taskRepo.create({
        projectId: ctx.project.id,
        title: options.title,
        goal: options.goal,
        status: 'IN_PROGRESS',
        constraints,
        completedItems: [],
        remainingItems,
      });

      logSuccess(`Task created: ${colors.bold(task.title)} [ID: ${task.id}]`);
      console.log(`  Goal:   ${task.goal}`);
      console.log(`  Status: ${colors.green(task.status)}`);
      break;
    }

    case 'update': {
      const targetTask = options.id ? ctx.taskRepo.findById(options.id) : ctx.activeTask;
      if (!targetTask) {
        logError('No active task found to update. Specify --id <task_id>.');
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
      });

      logSuccess(`Task updated: ${colors.bold(updated.title)}`);
      console.log(`  Status:  ${colors.cyan(updated.status)}`);
      if (updated.blocker) console.log(`  Blocker: ${colors.red(updated.blocker)}`);
      break;
    }

    case 'complete': {
      const targetTask = options.id ? ctx.taskRepo.findById(options.id) : ctx.activeTask;
      if (!targetTask) {
        logError('No active task to complete. Specify --id <task_id>.');
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
      const targetTask = options.id ? ctx.taskRepo.findById(options.id) : ctx.activeTask;
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
        console.log(`• ${colors.bold(t.title)} (${t.status})${isCurrent}`);
        console.log(`  ID:   ${colors.dim(t.id)}`);
        console.log(`  Goal: ${t.goal}`);
        if (t.blocker) console.log(`  ${colors.red('Blocker:')} ${t.blocker}`);
        console.log('');
      }
      break;
    }
  }
}
