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

  it('lists all 5 core tools via tools/list', () => {
    const res = callServer({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    });

    expect(res?.result.tools).toHaveLength(5);
    const toolNames = res?.result.tools.map((t: any) => t.name);
    expect(toolNames).toContain('get_current_task');
    expect(toolNames).toContain('save_context');
    expect(toolNames).toContain('record_decision');
    expect(toolNames).toContain('create_handoff');
    expect(toolNames).toContain('get_git_context');
  });

  it('saves context and retrieves current task via tools/call', () => {
    // 1. Call save_context to create new task
    const saveRes = callServer({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'save_context',
        arguments: {
          title: 'Implement OAuth Flow',
          goal: 'Add Google and GitHub OAuth 2.0 authentication',
          newConstraints: ['Tokens must be encrypted with AES-256-GCM'],
          completedItems: ['Setup Google developer console app'],
          remainingItems: ['Implement token exchange endpoint', 'Add session cookie middleware'],
          status: 'IN_PROGRESS',
        },
      },
    });

    expect(saveRes?.result.isError).toBeFalsy();
    const saveContent = JSON.parse(saveRes?.result.content[0].text);
    expect(saveContent.task.title).toBe('Implement OAuth Flow');
    expect(saveContent.task.status).toBe('IN_PROGRESS');

    // 2. Call get_current_task to verify persistence
    const getRes = callServer({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'get_current_task',
        arguments: {},
      },
    });

    expect(getRes?.result.isError).toBeFalsy();
    const taskData = JSON.parse(getRes?.result.content[0].text);
    expect(taskData.title).toBe('Implement OAuth Flow');
    expect(taskData.constraints).toContain('Tokens must be encrypted with AES-256-GCM');
    expect(taskData.completedItems).toContain('Setup Google developer console app');
    expect(taskData.remainingItems).toContain('Implement token exchange endpoint');
  });

  it('records architectural decisions and handles supersession', () => {
    // 1. Record Decision A
    const decResA = callServer({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'record_decision',
        arguments: {
          title: 'Use JWT for Sessions',
          rationale: 'Stateless session tokens stored in HTTP-only cookies',
          relatedFiles: ['src/auth/jwt.ts'],
        },
      },
    });

    const parsedA = JSON.parse(decResA?.result.content[0].text);
    expect(parsedA.decision.title).toBe('Use JWT for Sessions');
    expect(parsedA.decision.status).toBe('ACTIVE');

    // 2. Record Decision B superseding Decision A
    const decResB = callServer({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'record_decision',
        arguments: {
          title: 'Use Redis Session Store',
          rationale: 'Allows instant session revocation without waiting for token expiry',
          relatedFiles: ['src/auth/session.ts'],
          supersedesDecisionId: parsedA.decision.id,
        },
      },
    });

    const parsedB = JSON.parse(decResB?.result.content[0].text);
    expect(parsedB.decision.title).toBe('Use Redis Session Store');
    expect(parsedB.decision.status).toBe('ACTIVE');
    expect(parsedB.supersededId).toBe(parsedA.decision.id);
  });

  it('retrieves git working tree context via get_git_context', () => {
    // Create new modified file in workspace
    const newFile = path.join(tmpWorkspace, 'auth.ts');
    fs.writeFileSync(newFile, 'export const secret = "oauth_test";\n', 'utf-8');
    execFileSync('git', ['add', '.'], { cwd: tmpWorkspace });

    const gitRes = callServer({
      jsonrpc: '2.0',
      id: 7,
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
    // Setup task
    callServer({
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: {
        name: 'save_context',
        arguments: {
          title: 'Refactor DB Connection Pool',
          goal: 'Improve connection reuse and eliminate pool exhaustion under load',
          status: 'IN_PROGRESS',
        },
      },
    });

    // Call create_handoff
    const handoffRes = callServer({
      jsonrpc: '2.0',
      id: 9,
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
    expect(handoffData.markdown).toContain('Refactor DB Connection Pool');
    expect(handoffData.tokenCountEstimate).toBeGreaterThan(0);
    expect(fs.existsSync(handoffData.handoffPath)).toBe(true);
  });
});
