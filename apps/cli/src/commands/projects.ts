import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { createDatabaseConnection, ProjectRepository, TaskRepository } from '@contextos/storage';
import { getCliContext } from '../context.js';
import { colors, banner } from '../ui.js';

export interface ProjectsCommandOptions {
  global?: boolean;
}

export function handleProjects(options: ProjectsCommandOptions = {}): void {
  const ctx = getCliContext({ forceGlobal: Boolean(options.global) });
  const projects = ctx.projectRepo.list();

  console.log(banner());
  console.log(colors.bold('--- Registered Projects in ContextOS ---'));
  console.log(`Active Storage: ${colors.dim(ctx.dbPath)}\n`);

  if (projects.length === 0) {
    console.log(colors.dim('  No projects registered in active storage.'));
  } else {
    for (const p of projects) {
      const isCurrent = p.id === ctx.project.id ? colors.green(' [CURRENT]') : '';
      const activeTask = ctx.taskRepo.findActiveByProject(p.id);
      const taskInfo = activeTask
        ? `${colors.bold(activeTask.title)} (${colors.green(activeTask.status)})${activeTask.jiraId ? ` [${colors.cyan(activeTask.jiraId)}]` : ''}`
        : colors.dim('No active task');

      console.log(`• ${colors.bold(p.name)}${isCurrent}`);
      console.log(`  Path:   ${colors.dim(p.rootPath)}`);
      console.log(`  Active: ${taskInfo}`);
      console.log('');
    }
  }

  // If active storage is local, also list projects from global storage
  const globalDbPath = path.join(os.homedir(), '.contextos', 'context.db');
  if (!options.global && ctx.dbPath !== globalDbPath && fs.existsSync(globalDbPath)) {
    try {
      const globalDb = createDatabaseConnection({ dbPath: globalDbPath });
      const globalProjRepo = new ProjectRepository(globalDb);
      const globalTaskRepo = new TaskRepository(globalDb);
      const globalProjects = globalProjRepo.list();

      console.log(`${colors.bold('--- Global System Storage Projects (~/.contextos/context.db) ---')}\n`);
      if (globalProjects.length === 0) {
        console.log(colors.dim('  No projects registered in global storage.'));
      } else {
        for (const p of globalProjects) {
          const activeTask = globalTaskRepo.findActiveByProject(p.id);
          const taskInfo = activeTask
            ? `${colors.bold(activeTask.title)} (${colors.green(activeTask.status)})${activeTask.jiraId ? ` [${colors.cyan(activeTask.jiraId)}]` : ''}`
            : colors.dim('No active task');

          console.log(`• ${colors.bold(p.name)}`);
          console.log(`  Path:   ${colors.dim(p.rootPath)}`);
          console.log(`  Active: ${taskInfo}`);
          console.log('');
        }
      }
    } catch {
      // ignore
    }
  }
}
