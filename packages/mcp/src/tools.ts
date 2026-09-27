import type { McpTool } from './protocol.js';

export const MCP_TOOLS: McpTool[] = [
  {
    name: 'get_current_task',
    description: 'Returns the active task, constraints, completed items, remaining items, and blockers.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Optional project ID. If omitted, uses active workspace project.',
        },
      },
    },
  },
  {
    name: 'save_context',
    description: 'Updates task state, records completed items, or logs new constraints.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Optional task ID. If omitted, updates active task or creates new task.',
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
    name: 'record_decision',
    description: 'Records an architectural invariant or supersedes an older decision.',
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
    name: 'create_handoff',
    description: 'Triggers context compilation, writes .contextos/handoffs/latest.md, and returns the markdown payload.',
    inputSchema: {
      type: 'object',
      properties: {
        fromAgent: {
          type: 'string',
          description: 'Name of the agent creating the handoff (e.g., claude)',
        },
        toAgent: {
          type: 'string',
          description: 'Name of the downstream agent receiving the handoff (e.g., codex)',
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
      },
      required: ['fromAgent', 'toAgent', 'targetPhase'],
    },
  },
  {
    name: 'get_git_context',
    description: 'Retrieves branch information, modified files, and noise-filtered diff.',
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
];
