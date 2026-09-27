import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import type {
  Project,
  Task,
  HandoffPhase,
  TaskStatus,
} from '@contextos/core';
import {
  createDatabaseConnection,
  ProjectRepository,
  TaskRepository,
  DecisionRepository,
  IssueRepository,
  HandoffRepository,
} from '@contextos/storage';
import { GitClient } from '@contextos/git';
import { HandoffCompiler } from '@contextos/context-builder';
import type { McpToolCallResult } from './protocol.js';

export interface McpServerContext {
  cwd: string;
  projectRoot: string;
  dbPath?: string;
  project: Project;
  projectRepo: ProjectRepository;
  taskRepo: TaskRepository;
  decisionRepo: DecisionRepository;
  issueRepo: IssueRepository;
  handoffRepo: HandoffRepository;
  gitClient: GitClient;
}

export function findTaskWithCrossStorageFallback(
  ctx: McpServerContext,
  opts: { taskId?: string; jiraId?: string }
): { task: Task | null; repo: TaskRepository } {
  let task: Task | null = null;
  if (opts.taskId) {
    task = ctx.taskRepo.findById(opts.taskId);
    if (task) return { task, repo: ctx.taskRepo };
  }
  if (opts.jiraId) {
    task = ctx.taskRepo.findByJiraId(ctx.project.id, opts.jiraId);
    if (task) return { task, repo: ctx.taskRepo };
  }

  // Cross-storage fallback: check global DB
  const globalDbPath = path.join(os.homedir(), '.contextos', 'context.db');
  if (ctx.dbPath !== globalDbPath && fs.existsSync(globalDbPath)) {
    try {
      const globalDb = createDatabaseConnection({ dbPath: globalDbPath });
      const globalTaskRepo = new TaskRepository(globalDb);
      const found = opts.jiraId
        ? globalTaskRepo.findByJiraId('', opts.jiraId)
        : opts.taskId
        ? globalTaskRepo.findById(opts.taskId)
        : null;
      if (found) return { task: found, repo: globalTaskRepo };
    } catch {
      // ignore
    }
  }

  return { task: null, repo: ctx.taskRepo };
}

export function handleGetCurrentTask(
  args: { projectId?: string; jiraId?: string },
  ctx: McpServerContext
): McpToolCallResult {
  const projectId = args.projectId || ctx.project.id;
  let activeTask: Task | null = null;

  if (args.jiraId) {
    const res = findTaskWithCrossStorageFallback(ctx, { jiraId: args.jiraId });
    activeTask = res.task;
  } else {
    activeTask = ctx.taskRepo.findActiveByProject(projectId);
  }

  if (!activeTask) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              message: args.jiraId
                ? `No task found with Jira ID: ${args.jiraId}`
                : 'No active task found for project.',
              projectId,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(activeTask, null, 2),
      },
    ],
  };
}

export function handleSaveContext(
  args: {
    taskId?: string;
    jiraId?: string;
    title?: string;
    goal?: string;
    completedItems?: string[];
    remainingItems?: string[];
    newConstraints?: string[];
    blocker?: string | null;
    status?: TaskStatus;
  },
  ctx: McpServerContext
): McpToolCallResult {
  let { task, repo } = findTaskWithCrossStorageFallback(ctx, {
    taskId: args.taskId,
    jiraId: args.jiraId,
  });

  if (!task) {
    task = ctx.taskRepo.findActiveByProject(ctx.project.id);
    repo = ctx.taskRepo;
  }

  if (!task) {
    // Create new task if none exists
    const title =
      args.title ||
      (args.jiraId ? `${args.jiraId.toUpperCase()} Task` : 'Autonomous Agent Session');
    const goal = args.goal || 'Agent task execution';
    task = ctx.taskRepo.create({
      projectId: ctx.project.id,
      title,
      goal,
      status: args.status || 'IN_PROGRESS',
      constraints: args.newConstraints || [],
      completedItems: args.completedItems || [],
      remainingItems: args.remainingItems || [],
      blocker: args.blocker || null,
      jiraId: args.jiraId ? args.jiraId.trim().toUpperCase() : undefined,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ message: 'New task created and context saved.', task }, null, 2),
        },
      ],
    };
  }

  // Update existing task
  const updated = repo.update(task.id, {
    title: args.title,
    goal: args.goal,
    status: args.status,
    blocker: args.blocker,
    jiraId: args.jiraId ? args.jiraId.trim().toUpperCase() : undefined,
    addConstraints: args.newConstraints,
    addCompletedItems: args.completedItems,
    addRemainingItems: args.remainingItems,
  });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ message: 'Context updated successfully.', task: updated }, null, 2),
      },
    ],
  };
}

export function handleRecordDecision(
  args: {
    title: string;
    rationale: string;
    relatedFiles?: string[];
    supersedesDecisionId?: string;
  },
  ctx: McpServerContext
): McpToolCallResult {
  const dec = ctx.decisionRepo.create({
    projectId: ctx.project.id,
    title: args.title,
    rationale: args.rationale,
    status: 'ACTIVE',
    relatedFiles: args.relatedFiles || [],
  });

  if (args.supersedesDecisionId) {
    ctx.decisionRepo.supersede(args.supersedesDecisionId, dec.id);
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            message: 'Architectural decision recorded.',
            decision: dec,
            supersededId: args.supersedesDecisionId || null,
          },
          null,
          2
        ),
      },
    ],
  };
}

export function handleCreateHandoff(
  args: {
    fromAgent: string;
    toAgent: string;
    targetPhase: HandoffPhase;
    taskId?: string;
    jiraId?: string;
  },
  ctx: McpServerContext
): McpToolCallResult {
  let task = (args.taskId || args.jiraId)
    ? findTaskWithCrossStorageFallback(ctx, { taskId: args.taskId, jiraId: args.jiraId }).task
    : ctx.taskRepo.findActiveByProject(ctx.project.id);

  if (!task) {
    const defaultTitle = args.jiraId
      ? `${args.jiraId.toUpperCase()} Agent Session`
      : `${ctx.project.name} Agent Session`;
    task = ctx.taskRepo.create({
      projectId: ctx.project.id,
      title: defaultTitle,
      goal: 'Continuous agent task execution',
      status: 'IN_PROGRESS',
      constraints: [],
      completedItems: [],
      remainingItems: [],
      jiraId: args.jiraId ? args.jiraId.trim().toUpperCase() : undefined,
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
    fromAgent: args.fromAgent,
    toAgent: args.toAgent,
    targetPhase: args.targetPhase,
    outputDir: handoffsDir,
  });

  ctx.handoffRepo.create({
    taskId: task.id,
    fromAgent: args.fromAgent,
    toAgent: args.toAgent,
    targetPhase: args.targetPhase,
    markdownPayload: result.markdown,
  });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            handoffPath: result.latestPath,
            archivePath: result.archivePath,
            tokenCountEstimate: result.tokenCountEstimate,
            markdown: result.markdown,
          },
          null,
          2
        ),
      },
    ],
  };
}

export function handleGetGitContext(
  args: { maxLines?: number },
  ctx: McpServerContext
): McpToolCallResult {
  const maxLines = args.maxLines || 1000;
  const gitContext = ctx.gitClient.getFilteredContext({ maxTotalLines: maxLines });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(gitContext, null, 2),
      },
    ],
  };
}
