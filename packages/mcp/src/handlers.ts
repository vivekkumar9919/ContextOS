import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import type {
  Project,
  Task,
  Decision,
  HandoffPhase,
  TaskStatus,
} from '@contextos/core';
import {
  ProjectRepository,
  TaskRepository,
  DecisionRepository,
  IssueRepository,
  HandoffRepository,
  createDatabaseConnection,
} from '@contextos/storage';
import { GitClient } from '@contextos/git';
import { HandoffCompiler } from '@contextos/context-builder';
import type { McpToolCallResult } from './protocol.js';

export interface McpServerContext {
  cwd: string;
  projectRoot: string;
  project: Project;
  projectRepo: ProjectRepository;
  taskRepo: TaskRepository;
  decisionRepo: DecisionRepository;
  issueRepo: IssueRepository;
  handoffRepo: HandoffRepository;
  gitClient: GitClient;
  dbPath?: string;
  isGlobal?: boolean;
}

interface AlternateStorage {
  dbPath: string;
  isGlobal: boolean;
  projectRepo: ProjectRepository;
  taskRepo: TaskRepository;
  decisionRepo: DecisionRepository;
}

function getAlternateStorage(ctx: McpServerContext): AlternateStorage | null {
  const globalDbPath = path.join(os.homedir(), '.contextos', 'context.db');
  const localDbPath = path.join(ctx.projectRoot, '.contextos', 'context.db');

  // If currently using local, check global
  if (!ctx.isGlobal && fs.existsSync(globalDbPath)) {
    try {
      const db = createDatabaseConnection({ dbPath: globalDbPath });
      return {
        dbPath: globalDbPath,
        isGlobal: true,
        projectRepo: new ProjectRepository(db),
        taskRepo: new TaskRepository(db),
        decisionRepo: new DecisionRepository(db),
      };
    } catch {
      return null;
    }
  }

  // If currently using global, check local
  if (ctx.isGlobal && fs.existsSync(localDbPath)) {
    try {
      const db = createDatabaseConnection({ dbPath: localDbPath });
      return {
        dbPath: localDbPath,
        isGlobal: false,
        projectRepo: new ProjectRepository(db),
        taskRepo: new TaskRepository(db),
        decisionRepo: new DecisionRepository(db),
      };
    } catch {
      return null;
    }
  }

  return null;
}

export function handleGetStatus(
  args: { includeGlobal?: boolean },
  ctx: McpServerContext
): McpToolCallResult {
  const includeGlobal = args.includeGlobal !== false;
  let activeTask = ctx.taskRepo.findActiveByProject(ctx.project.id);
  let storageSource = ctx.isGlobal
    ? 'Global system storage (~/.contextos/context.db)'
    : 'Local workspace storage (.contextos/context.db)';

  if (!activeTask && includeGlobal) {
    const alt = getAlternateStorage(ctx);
    if (alt) {
      activeTask = alt.taskRepo.findActiveByProject(ctx.project.id) || null;
      if (activeTask) {
        storageSource = alt.isGlobal
          ? 'Global system storage (~/.contextos/context.db)'
          : 'Local workspace storage (.contextos/context.db)';
      }
    }
  }

  const activeDecisions = ctx.decisionRepo.listActiveByProject(ctx.project.id);
  const gitStatus = ctx.gitClient.getStatus();
  const headCommit = ctx.gitClient.getHeadCommit();

  const statusPayload = {
    project: {
      id: ctx.project.id,
      name: ctx.project.name,
      root: ctx.projectRoot,
    },
    storage: {
      mode: ctx.isGlobal ? 'global' : 'local',
      dbPath: ctx.dbPath || 'auto-resolved',
      source: storageSource,
    },
    git: {
      branch: gitStatus.branch,
      headCommit: headCommit ? `${headCommit.shortHash} ("${headCommit.message}")` : 'none',
      dirty: gitStatus.isDirty,
      modified: gitStatus.modified,
      added: gitStatus.added,
      deleted: gitStatus.deleted,
    },
    activeTask: activeTask
      ? {
          id: activeTask.id,
          jiraId: activeTask.jiraId,
          title: activeTask.title,
          goal: activeTask.goal,
          status: activeTask.status,
          constraints: activeTask.constraints,
          completedItems: activeTask.completedItems,
          remainingItems: activeTask.remainingItems,
          blocker: activeTask.blocker,
        }
      : null,
    activeDecisions: activeDecisions.map((d) => ({
      id: d.id,
      title: d.title,
      rationale: d.rationale,
      relatedFiles: d.relatedFiles,
    })),
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(statusPayload, null, 2),
      },
    ],
  };
}

export function handleGetCurrentTask(
  args: { projectId?: string; jiraId?: string; taskId?: string },
  ctx: McpServerContext
): McpToolCallResult {
  const projectId = args.projectId || ctx.project.id;
  let task: Task | null = null;
  let source = ctx.isGlobal ? 'global' : 'local';

  // 1. Try local/current storage
  if (args.taskId) {
    task = ctx.taskRepo.findById(args.taskId);
  } else if (args.jiraId) {
    task = ctx.taskRepo.findByJiraId(projectId, args.jiraId);
  } else {
    task = ctx.taskRepo.findActiveByProject(projectId);
  }

  // 2. Cross-storage fallback
  if (!task && (args.jiraId || args.taskId)) {
    const alt = getAlternateStorage(ctx);
    if (alt) {
      if (args.taskId) {
        task = alt.taskRepo.findById(args.taskId);
      } else if (args.jiraId) {
        task = alt.taskRepo.findByJiraId('', args.jiraId);
      }
      if (task) {
        source = alt.isGlobal ? 'global (~/.contextos/context.db)' : 'local (.contextos/context.db)';
      }
    }
  }

  if (!task) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              message: args.jiraId
                ? `No task found with Jira ID: ${args.jiraId}`
                : args.taskId
                ? `No task found with ID: ${args.taskId}`
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
        text: JSON.stringify({ ...task, _storageSource: source }, null, 2),
      },
    ],
  };
}

export function handleCreateTask(
  args: {
    title: string;
    goal: string;
    jiraId?: string;
    constraints?: string[];
    remainingItems?: string[];
    status?: 'IN_PROGRESS' | 'BACKLOG';
  },
  ctx: McpServerContext
): McpToolCallResult {
  const jiraId = args.jiraId ? args.jiraId.trim().toUpperCase() : undefined;
  const status = args.status || 'IN_PROGRESS';

  const task = ctx.taskRepo.create({
    projectId: ctx.project.id,
    title: args.title,
    goal: args.goal,
    status,
    constraints: args.constraints || [],
    completedItems: [],
    remainingItems: args.remainingItems || [],
    blocker: null,
    jiraId,
  });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            message: `Task '${task.title}' created successfully.`,
            task,
          },
          null,
          2
        ),
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
  let task: Task | null = null;
  let targetRepo = ctx.taskRepo;

  if (args.taskId) {
    task = ctx.taskRepo.findById(args.taskId);
  }
  if (!task && args.jiraId) {
    task = ctx.taskRepo.findByJiraId(ctx.project.id, args.jiraId);
  }
  if (!task) {
    task = ctx.taskRepo.findActiveByProject(ctx.project.id);
  }

  // Cross-storage lookup for update
  if (!task && args.jiraId) {
    const alt = getAlternateStorage(ctx);
    if (alt) {
      const altTask = alt.taskRepo.findByJiraId('', args.jiraId);
      if (altTask) {
        task = altTask;
        targetRepo = alt.taskRepo;
      }
    }
  }

  if (!task) {
    // Create new task if none exists
    const title =
      args.title ||
      (args.jiraId ? `${args.jiraId.toUpperCase()} Task` : 'Autonomous Agent Session');
    const goal = args.goal || 'Agent task execution';
    task = targetRepo.create({
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
  const updated = targetRepo.update(task.id, {
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

export function handleListTasks(
  args: {
    projectId?: string;
    status?: TaskStatus;
    jiraId?: string;
    includeGlobal?: boolean;
  },
  ctx: McpServerContext
): McpToolCallResult {
  const projectId = args.projectId || ctx.project.id;
  const includeGlobal = args.includeGlobal !== false;

  let tasks = ctx.taskRepo.listByProject(projectId);

  if (includeGlobal) {
    const alt = getAlternateStorage(ctx);
    if (alt) {
      const altTasks = alt.taskRepo.listAll();
      const existingIds = new Set(tasks.map((t) => t.id));
      for (const t of altTasks) {
        if (!existingIds.has(t.id)) {
          tasks.push(t);
        }
      }
    }
  }

  if (args.status) {
    tasks = tasks.filter((t) => t.status === args.status);
  }

  if (args.jiraId) {
    const filterJira = args.jiraId.trim().toUpperCase();
    tasks = tasks.filter((t) => t.jiraId && t.jiraId.toUpperCase() === filterJira);
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ total: tasks.length, tasks }, null, 2),
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

export function handleListDecisions(
  args: {
    projectId?: string;
    status?: 'ACTIVE' | 'SUPERSEDED';
    includeGlobal?: boolean;
  },
  ctx: McpServerContext
): McpToolCallResult {
  const projectId = args.projectId || ctx.project.id;
  const includeGlobal = args.includeGlobal !== false;

  let decisions = ctx.decisionRepo.listAllByProject(projectId);

  if (includeGlobal) {
    const alt = getAlternateStorage(ctx);
    if (alt) {
      const altDecisions = alt.decisionRepo.listAll();
      const existingIds = new Set(decisions.map((d) => d.id));
      for (const d of altDecisions) {
        if (!existingIds.has(d.id)) {
          decisions.push(d);
        }
      }
    }
  }

  if (args.status) {
    decisions = decisions.filter((d) => d.status === args.status);
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ total: decisions.length, decisions }, null, 2),
      },
    ],
  };
}

export function handleListProjects(
  args: { includeGlobal?: boolean },
  ctx: McpServerContext
): McpToolCallResult {
  const includeGlobal = args.includeGlobal !== false;
  const projectList: Array<{
    id: string;
    name: string;
    rootPath: string;
    storage: string;
    activeTask: Task | null;
  }> = [];

  const localProjects = ctx.projectRepo.list();
  for (const p of localProjects) {
    const activeTask = ctx.taskRepo.findActiveByProject(p.id);
    projectList.push({
      id: p.id,
      name: p.name,
      rootPath: p.rootPath,
      storage: ctx.isGlobal ? 'global' : 'local',
      activeTask,
    });
  }

  if (includeGlobal) {
    const alt = getAlternateStorage(ctx);
    if (alt) {
      const altProjects = alt.projectRepo.list();
      const existingRoots = new Set(projectList.map((p) => p.rootPath));
      for (const p of altProjects) {
        if (!existingRoots.has(p.rootPath)) {
          const activeTask = alt.taskRepo.findActiveByProject(p.id);
          projectList.push({
            id: p.id,
            name: p.name,
            rootPath: p.rootPath,
            storage: alt.isGlobal ? 'global' : 'local',
            activeTask,
          });
        }
      }
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ total: projectList.length, projects: projectList }, null, 2),
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
  let task = args.taskId
    ? ctx.taskRepo.findById(args.taskId)
    : args.jiraId
    ? ctx.taskRepo.findByJiraId(ctx.project.id, args.jiraId)
    : ctx.taskRepo.findActiveByProject(ctx.project.id);

  // Cross-storage fallback
  if (!task && args.jiraId) {
    const alt = getAlternateStorage(ctx);
    if (alt) {
      task = alt.taskRepo.findByJiraId('', args.jiraId);
    }
  }

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

export function handleCleanContext(
  args: { target: 'active_task' | 'project' },
  ctx: McpServerContext
): McpToolCallResult {
  if (args.target === 'active_task') {
    const activeTask = ctx.taskRepo.findActiveByProject(ctx.project.id);
    if (!activeTask) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ message: 'No active task found to clean.' }, null, 2),
          },
        ],
      };
    }
    const updated = ctx.taskRepo.update(activeTask.id, {
      status: 'COMPLETED',
      blocker: null,
    });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { message: 'Active task marked as COMPLETED.', task: updated },
            null,
            2
          ),
        },
      ],
    };
  }

  // Target === 'project'
  const tasks = ctx.taskRepo.listByProject(ctx.project.id);
  for (const t of tasks) {
    ctx.taskRepo.delete(t.id);
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            message: `Cleared all tasks for project '${ctx.project.name}'.`,
            deletedTasksCount: tasks.length,
          },
          null,
          2
        ),
      },
    ],
  };
}
