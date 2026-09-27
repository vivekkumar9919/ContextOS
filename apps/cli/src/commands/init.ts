import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createDatabaseConnection, migrateDatabase } from '@contextos/storage';
import { getCliContext } from '../context.js';
import { logSuccess, logInfo, colors } from '../ui.js';

export interface InitOptions {
  local?: boolean;
  global?: boolean;
}

export function handleInit(options: InitOptions): void {
  const cwd = process.cwd();
  const isLocal = Boolean(options.local);

  if (options.global) {
    const localDbPath = path.join(cwd, '.contextos', 'context.db');
    if (fs.existsSync(localDbPath)) {
      try {
        const localDb = createDatabaseConnection({ dbPath: localDbPath });
        const globalDbPath = path.join(os.homedir(), '.contextos', 'context.db');
        const globalDb = createDatabaseConnection({ dbPath: globalDbPath });
        const counts = migrateDatabase(localDb, globalDb);
        localDb.close();

        fs.unlinkSync(localDbPath);
        const wal = path.join(cwd, '.contextos', 'context.db-wal');
        if (fs.existsSync(wal)) fs.unlinkSync(wal);
        const shm = path.join(cwd, '.contextos', 'context.db-shm');
        if (fs.existsSync(shm)) fs.unlinkSync(shm);

        if (counts.tasks > 0 || counts.decisions > 0) {
          logSuccess(
            `Migrated existing local data to global storage: ${counts.tasks} task(s), ${counts.decisions} decision(s), ${counts.handoffs} handoff(s).`
          );
        } else {
          logInfo('Switched storage: Switched from local workspace to global system storage.');
        }
      } catch {
        try {
          fs.unlinkSync(localDbPath);
        } catch {
          // ignore
        }
      }
    }
  }

  let targetDir = isLocal ? path.join(cwd, '.contextos') : path.join(os.homedir(), '.contextos');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const ctx = getCliContext(cwd, isLocal);

  // If inside git repo, ensure .contextos/ is in .gitignore
  const gitignorePath = path.join(ctx.projectRoot, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    if (!gitignoreContent.includes('.contextos')) {
      fs.appendFileSync(gitignorePath, '\n.contextos/\n', 'utf-8');
      logInfo(`Added ${colors.bold('.contextos/')} to ${colors.dim(gitignorePath)}`);
    }
  }

  logSuccess(`ContextOS initialized successfully!`);
  console.log(`  ${colors.bold('Mode:')} ${isLocal ? 'Local workspace' : 'Global system home'}`);
  console.log(`  ${colors.bold('Directory:')} ${colors.dim(targetDir)}`);
  console.log(`  ${colors.bold('Database:')} ${colors.dim(ctx.dbPath)}`);
  console.log(`  ${colors.bold('Project:')} ${colors.green(ctx.projectName)} (${colors.dim(ctx.projectRoot)})`);
}
