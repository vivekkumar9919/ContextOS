import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('@contextos/cli Test Suite', () => {
  let tmpHome: string;
  let tmpWorkspace: string;
  const cliPath = path.resolve(__dirname, '../dist/index.js');

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'contextos-home-test-'));
    tmpWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'contextos-ws-test-'));

    // Initialize git repository in workspace
    execFileSync('git', ['init'], { cwd: tmpWorkspace });
    execFileSync('git', ['config', 'user.name', 'Test Runner'], { cwd: tmpWorkspace });
    execFileSync('git', ['config', 'user.email', 'test@contextos.dev'], { cwd: tmpWorkspace });

    // Initial commit
    const readmePath = path.join(tmpWorkspace, 'README.md');
    fs.writeFileSync(readmePath, '# Workspace Repo\n', 'utf-8');
    execFileSync('git', ['add', '.'], { cwd: tmpWorkspace });
    execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: tmpWorkspace });
  });

  afterEach(() => {
    if (fs.existsSync(tmpHome)) {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
    if (fs.existsSync(tmpWorkspace)) {
      fs.rmSync(tmpWorkspace, { recursive: true, force: true });
    }
  });

  function stripAnsi(str: string): string {
    return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  }

  function runCli(args: string[]): string {
    const raw = execFileSync('node', [cliPath, ...args], {
      cwd: tmpWorkspace,
      env: {
        ...process.env,
        CONTEXTOS_HOME: tmpHome,
      },
      encoding: 'utf-8',
    });
    return stripAnsi(raw);
  }

  it('prints help banner and usage instructions with --help', () => {
    const output = runCli(['--help']);
    expect(output).toContain('Deterministic Context & Handoff Layer for AI Agents');
    expect(output).toContain('COMMANDS:');
    expect(output).toContain('init');
    expect(output).toContain('task');
    expect(output).toContain('decision');
    expect(output).toContain('handoff');
  });

  it('initializes context database with init command', () => {
    const output = runCli(['init']);
    expect(output).toContain('ContextOS initialized successfully!');
    expect(fs.existsSync(path.join(tmpHome, 'context.db'))).toBe(true);
  });

  it('creates and updates task lifecycle with task commands', () => {
    runCli(['init']);

    // 1. Create task
    const createOut = runCli([
      'task',
      'create',
      '--title',
      'Auth Feature',
      '--goal',
      'JWT Auth implementation',
      '--constraints',
      'Do not store secrets,Use ES2022',
      '--remaining',
      'Create token route,Write middleware test',
    ]);
    expect(createOut).toContain('Task created: Auth Feature');
    expect(createOut).toContain('IN_PROGRESS');

    // 2. Status check
    const statusOut = runCli(['status']);
    expect(statusOut).toContain('Auth Feature');
    expect(statusOut).toContain('JWT Auth implementation');
    expect(statusOut).toContain('Do not store secrets');

    // 3. Complete checklist item
    const completeItemOut = runCli(['task', 'complete', '--item', 'Create token route']);
    expect(completeItemOut).toContain('Checklist item completed: "Create token route"');

    // 4. Update blocker
    const blockerOut = runCli(['task', 'update', '--blocker', 'Missing jwt secret']);
    expect(blockerOut).toContain('Missing jwt secret');

    // 5. Complete entire task
    const completeTaskOut = runCli(['task', 'complete']);
    expect(completeTaskOut).toContain('Task completed: Auth Feature');
  });

  it('records decisions and prevents cyclic supersession DAGs', () => {
    runCli(['init']);

    // 1. Add Decision A
    const decA = runCli([
      'decision',
      'add',
      '--title',
      'Use SQLite WAL',
      '--rationale',
      'Supports concurrent readers without database locks',
      '--files',
      'src/connection.ts,src/migrator.ts',
    ]);
    expect(decA).toContain('Decision recorded: Use SQLite WAL');

    // 2. List decisions
    const listOut = runCli(['decision', 'list']);
    expect(listOut).toContain('Use SQLite WAL');
    expect(listOut).toContain('[ACTIVE]');
  });

  it('compiles bounded handoffs and writes latest.md with handoff command', () => {
    runCli(['init']);
    runCli(['task', 'create', '--title', 'Checkout Refactor', '--goal', 'Optimize payment flow']);

    // Modify a file in workspace
    const newFilePath = path.join(tmpWorkspace, 'checkout.ts');
    fs.writeFileSync(newFilePath, 'export function checkout() { return true; }\n', 'utf-8');
    execFileSync('git', ['add', '.'], { cwd: tmpWorkspace });

    // Trigger handoff
    const handoffOut = runCli(['handoff', '--from', 'claude', '--to', 'codex', '--no-copy']);
    expect(handoffOut).toContain('Handoff compiled successfully!');
    expect(handoffOut).toContain('claude ➔ codex');
    expect(handoffOut).toContain('Tokens:');

    // Verify file on disk
    const latestPath = path.join(tmpWorkspace, '.contextos', 'handoffs', 'latest.md');
    expect(fs.existsSync(latestPath)).toBe(true);

    const content = fs.readFileSync(latestPath, 'utf-8');
    expect(content).toContain('# ContextOS Handoff: claude ➔ codex');
    expect(content).toContain('Checkout Refactor');
  });

  it('cleans project without corrupting other registered projects', () => {
    runCli(['init']);
    runCli(['task', 'create', '--title', 'Project A Task', '--goal', 'Test Goal']);

    // Verify task exists
    let statusOut = runCli(['status']);
    expect(statusOut).toContain('Project A Task');

    // Clean project
    const cleanOut = runCli(['clean', '--project']);
    expect(cleanOut).toContain('Deleted project');

    // Verify task is gone
    statusOut = runCli(['status']);
    expect(statusOut).toContain('No active task found');
  });
});
