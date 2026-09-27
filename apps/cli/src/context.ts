import * as path from 'node:path';
import * as fs from 'node:fs';
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

export function getCliContext(cwd: string = process.cwd(), localOnly = false): CliContext {
  const gitClient = new GitClient(cwd);
  const repoRoot = gitClient.getRepoRoot();
  const projectRoot = repoRoot || cwd;
  const projectName = detectProjectName(projectRoot);

  const dbPath = localOnly
    ? path.join(projectRoot, '.contextos', 'context.db')
    : getDbPath(projectRoot);
  const db = createDatabaseConnection({ dbPath, projectRoot });

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
