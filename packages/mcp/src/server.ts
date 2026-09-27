import * as readline from 'node:readline';
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
import type Database from 'better-sqlite3';
import {
  type JsonRpcRequest,
  type JsonRpcResponse,
  type McpToolCallResult,
} from './protocol.js';
import { MCP_TOOLS } from './tools.js';
import {
  type McpServerContext,
  handleGetCurrentTask,
  handleSaveContext,
  handleRecordDecision,
  handleCreateHandoff,
  handleGetGitContext,
} from './handlers.js';

export interface McpServerOptions {
  cwd?: string;
  dbPath?: string;
}

export class ContextOsMcpServer {
  private readonly ctx: McpServerContext;
  private readonly db: Database.Database;

  constructor(options: McpServerOptions = {}) {
    const cwd = options.cwd || process.cwd();
    const gitClient = new GitClient(cwd);
    const repoRoot = gitClient.getRepoRoot();
    const projectRoot = repoRoot || cwd;

    // Detect project name from package.json if present
    let projectName = path.basename(projectRoot);
    const pkgPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.name) projectName = pkg.name;
      } catch {
        // fallback
      }
    }

    const dbPath = options.dbPath || getDbPath(projectRoot);
    this.db = createDatabaseConnection({ dbPath, projectRoot });

    const projectRepo = new ProjectRepository(this.db);
    const taskRepo = new TaskRepository(this.db);
    const decisionRepo = new DecisionRepository(this.db);
    const issueRepo = new IssueRepository(this.db);
    const handoffRepo = new HandoffRepository(this.db);

    const project = projectRepo.findOrCreate(projectName, projectRoot);

    this.ctx = {
      cwd,
      projectRoot,
      dbPath,
      project,
      projectRepo,
      taskRepo,
      decisionRepo,
      issueRepo,
      handoffRepo,
      gitClient,
    };
  }

  public handleRequest(req: JsonRpcRequest): JsonRpcResponse | null {
    const { id, method, params } = req;

    // Notifications (no id)
    if (id === undefined || id === null) {
      if (method === 'notifications/initialized') {
        // Client confirmed initialization
        return null;
      }
      return null;
    }

    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'contextos-mcp',
              version: '1.0.0',
            },
          },
        };

      case 'ping':
        return {
          jsonrpc: '2.0',
          id,
          result: {},
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: MCP_TOOLS,
          },
        };

      case 'tools/call': {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        let toolResult: McpToolCallResult;

        try {
          switch (toolName) {
            case 'get_current_task':
              toolResult = handleGetCurrentTask(toolArgs, this.ctx);
              break;
            case 'save_context':
              toolResult = handleSaveContext(toolArgs, this.ctx);
              break;
            case 'record_decision':
              toolResult = handleRecordDecision(toolArgs, this.ctx);
              break;
            case 'create_handoff':
              toolResult = handleCreateHandoff(toolArgs, this.ctx);
              break;
            case 'get_git_context':
              toolResult = handleGetGitContext(toolArgs, this.ctx);
              break;
            default:
              return {
                jsonrpc: '2.0',
                id,
                error: {
                  code: -32601,
                  message: `Method not found: unknown tool '${toolName}'`,
                },
              };
          }

          return {
            jsonrpc: '2.0',
            id,
            result: toolResult,
          };
        } catch (err: any) {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: `Error executing ${toolName}: ${err.message}`,
                },
              ],
              isError: true,
            },
          };
        }
      }

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: '${method}'`,
          },
        };
    }
  }

  public startStdio(
    inStream: NodeJS.ReadableStream = process.stdin,
    outStream: NodeJS.WritableStream = process.stdout
  ): void {
    const rl = readline.createInterface({
      input: inStream,
      output: undefined,
      terminal: false,
    });

    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const req = JSON.parse(trimmed) as JsonRpcRequest;
        const res = this.handleRequest(req);
        if (res) {
          outStream.write(JSON.stringify(res) + '\n');
        }
      } catch (err: any) {
        const errResponse: JsonRpcResponse = {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: `Parse error: ${err.message}`,
          },
        };
        outStream.write(JSON.stringify(errResponse) + '\n');
      }
    });
  }

  public close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}
