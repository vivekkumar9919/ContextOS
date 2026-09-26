import * as fs from 'node:fs';
import * as path from 'node:path';
import { getCliContext } from '../context.js';
import { logSuccess, logError, logWarning, colors } from '../ui.js';

export interface CleanCommandOptions {
  project?: boolean;
  all?: boolean;
}

export function handleClean(options: CleanCommandOptions): void {
  const ctx = getCliContext();

  if (options.all) {
    const localDir = path.join(ctx.projectRoot, '.contextos');
    if (fs.existsSync(localDir)) {
      fs.rmSync(localDir, { recursive: true, force: true });
      logSuccess(`Removed local workspace directory: ${colors.dim(localDir)}`);
    } else {
      logWarning(`No local .contextos directory found at: ${colors.dim(localDir)}`);
    }
    return;
  }

  if (options.project || (!options.project && !options.all)) {
    const deleted = ctx.projectRepo.delete(ctx.project.id);
    if (deleted) {
      logSuccess(`Deleted project ${colors.bold(ctx.projectName)} and all associated tasks, decisions, and issues.`);
    } else {
      logError(`Could not find project to clean.`);
    }
    return;
  }
}
