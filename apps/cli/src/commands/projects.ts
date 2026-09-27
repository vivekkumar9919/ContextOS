import { getCliContext } from '../context.js';
import { colors, banner } from '../ui.js';

export function handleProjects(): void {
  const ctx = getCliContext();
  const projects = ctx.projectRepo.list();

  console.log(banner());
  console.log(colors.bold('--- Registered Projects in ContextOS ---'));
  console.log(`Storage: ${colors.dim(ctx.dbPath)}\n`);

  if (projects.length === 0) {
    console.log('No projects registered yet.');
    return;
  }

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
