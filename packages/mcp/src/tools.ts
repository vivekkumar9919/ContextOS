import type { McpTool } from './protocol.js';

export const MCP_TOOLS: McpTool[] = [
  {
    name: 'get_status',
    description:
      'Returns a consolidated status dashboard showing active project info, storage mode, Git working tree, active task, and active decisions (equivalent to `contextos status`).',
    inputSchema: {
      type: 'object',
      properties: {
        includeGlobal: {
          type: 'boolean',
          description: 'Whether to include or check global storage (~/.contextos/context.db). Defaults to true.',
        },
      },
    },
  },
  {
    name: 'get_current_task',
    description:
      'Returns the active task, constraints, completed items, remaining items, and blockers. Supports lookup by Jira ID or Task ID with automatic global cross-storage fallback.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Optional project ID. If omitted, uses active workspace project.',
        },
        jiraId: {
          type: 'string',
          description: 'Optional Jira ticket ID (e.g., PROJ-123) to fetch context for a specific ticket.',
        },
        taskId: {
          type: 'string',
          description: 'Optional specific task ID to retrieve.',
        },
      },
    },
  },
  {
    name: 'create_task',
    description:
      'Creates a new task with title, goal, optional Jira ticket, constraints, and checklist (equivalent to `contextos task create`).',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the software task',
        },
        goal: {
          type: 'string',
          description: 'High-level goal and success criteria',
        },
        jiraId: {
          type: 'string',
          description: 'Optional Jira ticket ID (e.g. PROJ-123)',
        },
        constraints: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of architectural invariants or constraints that must be preserved',
        },
        remainingItems: {
          type: 'array',
          items: { type: 'string' },
          description: 'Checklist of remaining items to implement',
        },
        status: {
          type: 'string',
          enum: ['IN_PROGRESS', 'BACKLOG'],
          description: 'Initial task status (default: IN_PROGRESS)',
        },
      },
      required: ['title', 'goal'],
    },
  },
  {
    name: 'save_context',
    description:
      'Updates task state, records completed items, adds remaining steps, logs new constraints, or updates/clears blockers (equivalent to `contextos task update / complete / clear`).',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Optional task ID. If omitted, updates active task or creates new task.',
        },
        jiraId: {
          type: 'string',
          description: 'Optional Jira ticket ID (e.g., PROJ-123) to associate with this task.',
        },
        title: {
          type: 'string',
          description: 'Task title (used if creating a new task or updating existing title)',
        },
        goal: {
          type: 'string',
          description: 'Task goal description',
        },
        completedItems: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of checklist items that were completed in this turn',
        },
        remainingItems: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of next pending steps / remaining checklist items',
        },
        newConstraints: {
          type: 'array',
          items: { type: 'string' },
          description: 'New architectural invariants or constraints that must be preserved',
        },
        blocker: {
          type: ['string', 'null'],
          description: 'Active blocker description or null to clear',
        },
        status: {
          type: 'string',
          enum: ['IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'BACKLOG'],
          description: 'Current task status',
        },
      },
    },
  },
  {
    name: 'list_tasks',
    description:
      'Lists all recorded tasks with their status, checklist progress, and Jira tickets (equivalent to `contextos task list`).',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Optional project ID to filter by. Defaults to active project.',
        },
        status: {
          type: 'string',
          enum: ['IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'BACKLOG'],
          description: 'Optional status filter',
        },
        jiraId: {
          type: 'string',
          description: 'Optional Jira ticket filter',
        },
        includeGlobal: {
          type: 'boolean',
          description: 'Whether to also search global storage (~/.contextos/context.db). Defaults to true.',
        },
      },
    },
  },
  {
    name: 'record_decision',
    description:
      'Records an architectural invariant or supersedes an older decision with DAG cycle check (equivalent to `contextos decision add / supersede`).',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the architectural decision',
        },
        rationale: {
          type: 'string',
          description: 'Technical rationale and context for the decision',
        },
        relatedFiles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of file paths impacted by or related to this decision',
        },
        supersedesDecisionId: {
          type: 'string',
          description: 'ID of an older decision being superseded',
        },
      },
      required: ['title', 'rationale'],
    },
  },
  {
    name: 'list_decisions',
    description:
      'Lists all architectural decisions (active and superseded) and invariants (equivalent to `contextos decision list`).',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Optional project ID to filter by. Defaults to active project.',
        },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'SUPERSEDED'],
          description: 'Optional status filter (ACTIVE or SUPERSEDED)',
        },
        includeGlobal: {
          type: 'boolean',
          description: 'Whether to also include decisions from global storage. Defaults to true.',
        },
      },
    },
  },
  {
    name: 'list_projects',
    description:
      'Lists all registered projects, their root directories, and their active tasks across storage (equivalent to `contextos projects`).',
    inputSchema: {
      type: 'object',
      properties: {
        includeGlobal: {
          type: 'boolean',
          description: 'Whether to include projects from global storage (~/.contextos/context.db). Defaults to true.',
        },
      },
    },
  },
  {
    name: 'create_handoff',
    description:
      'Triggers context compilation, writes .contextos/handoffs/latest.md, and returns bounded markdown payload (equivalent to `contextos handoff`).',
    inputSchema: {
      type: 'object',
      properties: {
        fromAgent: {
          type: 'string',
          description: 'Name of the agent creating the handoff (e.g., claude, antigravity)',
        },
        toAgent: {
          type: 'string',
          description: 'Name of the downstream agent receiving the handoff (e.g., codex, cursor)',
        },
        targetPhase: {
          type: 'string',
          enum: ['planning', 'implementation', 'review'],
          description: 'Target workflow phase for the downstream agent',
        },
        taskId: {
          type: 'string',
          description: 'Optional task ID to summarize. Defaults to active task.',
        },
        jiraId: {
          type: 'string',
          description: 'Optional Jira ticket ID (e.g., PROJ-123) to compile handoff for.',
        },
      },
      required: ['fromAgent', 'toAgent', 'targetPhase'],
    },
  },
  {
    name: 'get_git_context',
    description:
      'Retrieves Git branch information, modified files, and noise-filtered, secret-scanned diff.',
    inputSchema: {
      type: 'object',
      properties: {
        maxLines: {
          type: 'number',
          description: 'Maximum total diff lines to return (default 1000)',
        },
      },
    },
  },
  {
    name: 'clean_context',
    description:
      'Cleans or wipes ContextOS state for the active project or marks active task as completed (equivalent to `contextos clean`).',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          enum: ['active_task', 'project'],
          description: "Target to clean: 'active_task' (marks active task completed) or 'project' (deletes all tasks/decisions for project)",
        },
      },
      required: ['target'],
    },
  },
];
