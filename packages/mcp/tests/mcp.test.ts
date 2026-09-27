import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { ContextOsMcpServer } from '../src/server.js';
import type { JsonRpcRequest } from '../src/protocol.js';

describe('@contextos/mcp Test Suite', () => {
  let tmpHome: string;
  let tmpWorkspace: string;
  let server: ContextOsMcpServer;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'contextos-mcp-home-'));
    tmpWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'contextos-mcp-ws-'));

    // Initialize mock git repo
    execFileSync('git', ['init'], { cwd: tmpWorkspace });
    execFileSync('git', ['config', 'user.name', 'Test MCP'], { cwd: tmpWorkspace });
    execFileSync('git', ['config', 'user.email', 'test@mcp.dev'], { cwd: tmpWorkspace });

    const readmePath = path.join(tmpWorkspace, 'README.md');
    fs.writeFileSync(readmePath, '# Workspace Repo\n', 'utf-8');
    execFileSync('git', ['add', '.'], { cwd: tmpWorkspace });
    execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: tmpWorkspace });

    const dbPath = path.join(tmpHome, 'context.db');
    server = new ContextOsMcpServer({ cwd: tmpWorkspace, dbPath });
  });

  afterEach(() => {
    if (server) {
      server.close();
    }
    if (fs.existsSync(tmpHome)) {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
    if (fs.existsSync(tmpWorkspace)) {
      fs.rmSync(tmpWorkspace, { recursive: true, force: true });
    }
  });

  function callServer(req: JsonRpcRequest) {
    return server.handleRequest(req);
  }

  it('handles initialize handshake adhering to MCP 2024-11-05 protocol', () => {
    const res = callServer({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'Claude Code', version: '1.0.0' },
      },
    });

    expect(res).toBeDefined();
    expect(res?.id).toBe(1);
    expect(res?.result.protocolVersion).toBe('2024-11-05');
    expect(res?.result.serverInfo.name).toBe('contextos-mcp');
    expect(res?.result.capabilities.tools).toBeDefined();
  });

  it('lists all 11 core tools via tools/list', () => {
    const res = callServer({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    });

    expect(res?.result.tools).toHaveLength(11);
    const toolNames = res?.result.tools.map((t: any) => t.name);
    expect(toolNames).toContain('get_status');
    expect(toolNames).toContain('get_current_task');
    expect(toolNames).toContain('create_task');
    expect(toolNames).toContain('save_context');
    expect(toolNames).toContain('list_tasks');
    expect(toolNames).toContain('record_decision');
    expect(toolNames).toContain('list_decisions');
    expect(toolNames).toContain('list_projects');
    expect(toolNames).toContain('create_handoff');
    expect(toolNames).toContain('get_git_context');
    expect(toolNames).toContain('clean_context');
  });

  it('creates task via create_task and gets consolidated status via get_status', () => {
    // 1. Create a task explicitly
    const createRes = callServer({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'create_task',
        arguments: {
          title: 'Setup Webhook Ingestion',
          goal: 'Build HMAC verification for incoming webhooks',
          jiraId: 'PAY-100',
          constraints: ['Never store unencrypted tokens'],
          remainingItems: ['Add HMAC validator', 'Add DB model'],
        },
      },
    });

    expect(createRes?.result.isError).toBeFalsy();
    const createData = JSON.parse(createRes?.result.content[0].text);
    expect(createData.task.title).toBe('Setup Webhook Ingestion');
    expect(createData.task.jiraId).toBe('PAY-100');

    // 2. Call get_status to verify full dashboard
    const statusRes = callServer({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'get_status',
        arguments: {},
      },
    });

    expect(statusRes?.result.isError).toBeFalsy();
    const statusData = JSON.parse(statusRes?.result.content[0].text);
    expect(statusData.project.name).toBeDefined();
    expect(statusData.storage.mode).toBeDefined();
    expect(statusData.git.branch).toBeDefined();
    expect(statusData.activeTask.jiraId).toBe('PAY-100');
    expect(statusData.activeTask.title).toBe('Setup Webhook Ingestion');
  });

  it('lists tasks with filters via list_tasks', () => {
    callServer({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'create_task',
        arguments: {
          title: 'Task A',
          goal: 'First task',
          jiraId: 'TICK-1',
        },
      },
    });

    const listRes = callServer({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'list_tasks',
        arguments: {
          jiraId: 'TICK-1',
        },
      },
    });

    expect(listRes?.result.isError).toBeFalsy();
    const listData = JSON.parse(listRes?.result.content[0].text);
    expect(listData.total).toBe(1);
    expect(listData.tasks[0].jiraId).toBe('TICK-1');
  });

  it('records decisions and lists them via list_decisions', () => {
    // 1. Record Decision A
    const decResA = callServer({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: {
        name: 'record_decision',
        arguments: {
          title: 'Use JWT for Sessions',
          rationale: 'Stateless tokens in HTTP-only cookies',
          relatedFiles: ['src/auth/jwt.ts'],
        },
      },
    });

    const parsedA = JSON.parse(decResA?.result.content[0].text);
    expect(parsedA.decision.title).toBe('Use JWT for Sessions');
    expect(parsedA.decision.status).toBe('ACTIVE');

    // 2. Record Decision B superseding Decision A
    callServer({
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: {
        name: 'record_decision',
        arguments: {
          title: 'Use Redis Session Store',
          rationale: 'Allows instant session revocation',
          relatedFiles: ['src/auth/session.ts'],
          supersedesDecisionId: parsedA.decision.id,
        },
      },
    });

    // 3. List active decisions
    const activeRes = callServer({
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: {
        name: 'list_decisions',
        arguments: { status: 'ACTIVE' },
      },
    });

    const activeData = JSON.parse(activeRes?.result.content[0].text);
    expect(activeData.total).toBe(1);
    expect(activeData.decisions[0].title).toBe('Use Redis Session Store');

    // 4. List superseded decisions
    const supersededRes = callServer({
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: {
        name: 'list_decisions',
        arguments: { status: 'SUPERSEDED' },
      },
    });

    const supersededData = JSON.parse(supersededRes?.result.content[0].text);
    expect(supersededData.total).toBe(1);
    expect(supersededData.decisions[0].title).toBe('Use JWT for Sessions');
  });

  it('lists registered projects via list_projects', () => {
    const projRes = callServer({
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: {
        name: 'list_projects',
        arguments: {},
      },
    });

    expect(projRes?.result.isError).toBeFalsy();
    const projData = JSON.parse(projRes?.result.content[0].text);
    expect(projData.total).toBeGreaterThanOrEqual(1);
    expect(fs.realpathSync(projData.projects[0].rootPath)).toBe(fs.realpathSync(tmpWorkspace));
  });

  it('cleans context via clean_context', () => {
    callServer({
      jsonrpc: '2.0',
      id: 12,
      method: 'tools/call',
      params: {
        name: 'create_task',
        arguments: {
          title: 'Task To Clean',
          goal: 'Test cleaning',
        },
      },
    });

    const cleanRes = callServer({
      jsonrpc: '2.0',
      id: 13,
      method: 'tools/call',
      params: {
        name: 'clean_context',
        arguments: { target: 'active_task' },
      },
    });

    expect(cleanRes?.result.isError).toBeFalsy();
    const cleanData = JSON.parse(cleanRes?.result.content[0].text);
    expect(cleanData.task.status).toBe('COMPLETED');
  });

  it('retrieves git working tree context via get_git_context', () => {
    const newFile = path.join(tmpWorkspace, 'auth.ts');
    fs.writeFileSync(newFile, 'export const secret = "oauth_test";\n', 'utf-8');
    execFileSync('git', ['add', '.'], { cwd: tmpWorkspace });

    const gitRes = callServer({
      jsonrpc: '2.0',
      id: 14,
      method: 'tools/call',
      params: {
        name: 'get_git_context',
        arguments: { maxLines: 50 },
      },
    });

    expect(gitRes?.result.isError).toBeFalsy();
    const gitContext = JSON.parse(gitRes?.result.content[0].text);
    expect(gitContext.branch).toBeDefined();
    expect(gitContext.status.added).toContain('auth.ts');
  });

  it('compiles and returns bounded handoff payload via create_handoff', () => {
    callServer({
      jsonrpc: '2.0',
      id: 15,
      method: 'tools/call',
      params: {
        name: 'create_task',
        arguments: {
          title: 'Refactor DB Pool',
          goal: 'Improve connection reuse',
          status: 'IN_PROGRESS',
        },
      },
    });

    const handoffRes = callServer({
      jsonrpc: '2.0',
      id: 16,
      method: 'tools/call',
      params: {
        name: 'create_handoff',
        arguments: {
          fromAgent: 'claude',
          toAgent: 'codex',
          targetPhase: 'implementation',
        },
      },
    });

    expect(handoffRes?.result.isError).toBeFalsy();
    const handoffData = JSON.parse(handoffRes?.result.content[0].text);
    expect(handoffData.markdown).toContain('# ContextOS Handoff: claude ➔ codex');
    expect(handoffData.markdown).toContain('Refactor DB Pool');
    expect(handoffData.tokenCountEstimate).toBeGreaterThan(0);
    expect(fs.existsSync(handoffData.handoffPath)).toBe(true);
  });
});
