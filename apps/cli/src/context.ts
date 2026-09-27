import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import {
  createDatabaseConnection,
  getDbPath,
  ProjectRepository,
  TaskRepository,
  DecisionRepository,
  IssueRepository,
  HandoffRepository,
} from '@contextos/storage';
import { GitClient } from '@contextos/git';
import type { Project, Task } from '@contextos/core';
import type Database from 'better-sqlite3';

export interface GetCliContextOptions {
  cwd?: string;
  localOnly?: boolean;
  forceGlobal?: boolean;
}

export interface CliContext {
  cwd: string;
  projectRoot: string;
  projectName: string;
  dbPath: string;
  db: Database.Database;
  projectRepo: ProjectRepository;
  taskRepo: TaskRepository;
  decisionRepo: DecisionRepository;
  issueRepo: IssueRepository;
  handoffRepo: HandoffRepository;
  gitClient: GitClient;
  project: Project;
  activeTask: Task | null;
}

export function detectProjectName(projectRoot: string): string {
  const pkgPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.name) return pkg.name;
    } catch {
      // Fallback
    }
  }
  return path.basename(projectRoot);
}

export function getCliContext(
  cwdOrOptions?: string | GetCliContextOptions,
  localOnly = false
): CliContext {
  let cwd = process.cwd();
  let isLocal = localOnly;
  let forceGlobal = false;

  if (typeof cwdOrOptions === 'string') {
    cwd = cwdOrOptions;
  } else if (cwdOrOptions && typeof cwdOrOptions === 'object') {
    cwd = cwdOrOptions.cwd || process.cwd();
    isLocal = Boolean(cwdOrOptions.localOnly);
    forceGlobal = Boolean(cwdOrOptions.forceGlobal);
  }

  const gitClient = new GitClient(cwd);
  const repoRoot = gitClient.getRepoRoot();
  const projectRoot = repoRoot || cwd;
  const projectName = detectProjectName(projectRoot);

  const globalDir = process.env.CONTEXTOS_HOME || path.join(os.homedir(), '.contextos');
  const dbPath = forceGlobal
    ? path.join(globalDir, 'context.db')
    : isLocal
    ? path.join(projectRoot, '.contextos', 'context.db')
    : getDbPath(projectRoot);
  const db = createDatabaseConnection({ dbPath, projectRoot, forceGlobal });

  const projectRepo = new ProjectRepository(db);
  const taskRepo = new TaskRepository(db);
  const decisionRepo = new DecisionRepository(db);
  const issueRepo = new IssueRepository(db);
  const handoffRepo = new HandoffRepository(db);

  const project = projectRepo.findOrCreate(projectName, projectRoot);
  const activeTask = taskRepo.findActiveByProject(project.id);

  return {
    cwd,
    projectRoot,
    projectName,
    dbPath,
    db,
    projectRepo,
    taskRepo,
    decisionRepo,
    issueRepo,
    handoffRepo,
    gitClient,
    project,
    activeTask,
  };
}
