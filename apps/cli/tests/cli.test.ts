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

  it('supports Jira ticket linking and retrieval across local and global storage', () => {
    runCli(['init']);

    // Create task with Jira ID
    const createOut = runCli([
      'task',
      'create',
      '--title',
      'Payment Gateway Integration',
      '--goal',
      'Stripe webhooks implementation',
      '--jira',
      'PAY-404',
    ]);
    expect(createOut).toContain('Task created: Payment Gateway Integration');
    expect(createOut).toContain('PAY-404');

    // Retrieve task by Jira ticket ID
    const getOut = runCli(['task', 'get', '--jira', 'PAY-404']);
    expect(getOut).toContain('--- Task Context ---');
    expect(getOut).toContain('Payment Gateway Integration');
    expect(getOut).toContain('PAY-404');
    expect(getOut).toContain('Stripe webhooks implementation');

    // Verify projects command displays the task and Jira ticket
    const projectsOut = runCli(['projects']);
    expect(projectsOut).toContain('Registered Projects in ContextOS');
    expect(projectsOut).toContain('Payment Gateway Integration');
    expect(projectsOut).toContain('PAY-404');
  });

  it('manages bypass policies via policy CLI commands', () => {
    runCli(['init']);

    // List default seed policies
    const listOut = runCli(['policy', 'list']);
    expect(listOut).toContain('Bypass Policies (4):');
    expect(listOut).toContain('p-never');
    expect(listOut).toContain('p-human-only');
    expect(listOut).toContain('p-trusted-agents');
    expect(listOut).toContain('p-permissive');

    // Create custom policy
    const createOut = runCli([
      'policy',
      'add',
      'Deploy Policy',
      '--type',
      'SPECIFIC_AGENTS',
      '--agents',
      'release-bot,devops-agent',
      '--description',
      'Allow release bots only',
    ]);
    expect(createOut).toContain('Bypass Policy created');
    expect(createOut).toContain('Deploy Policy');
    expect(createOut).toContain('release-bot, devops-agent');
  });

  it('manages guardrails lifecycle and enforcement via guardrail CLI commands', () => {
    runCli(['init']);

    // 1. Add invariant guardrail
    const addInvOut = runCli([
      'guardrail',
      'add',
      'Never commit hardcoded secrets or API keys',
      '--title',
      'No Hardcoded Secrets',
      '--type',
      'INVARIANT',
      '--severity',
      'BLOCKER',
      '--policy',
      'p-human-only',
    ]);
    expect(addInvOut).toContain('Guardrail created');
    expect(addInvOut).toContain('No Hardcoded Secrets');
    expect(addInvOut).toContain('INVARIANT');

    // 2. Add action block guardrail for .env files
    const addBlockOut = runCli([
      'guardrail',
      'add',
      'Never touch env configuration files',
      '--title',
      'Protect Env Files',
      '--type',
      'ACTION_BLOCK',
      '--pattern',
      '\\.env.*',
      '--severity',
      'BLOCKER',
      '--policy',
      'p-human-only',
      '--remediation',
      'Use .env.example or vault instead',
    ]);
    expect(addBlockOut).toContain('Protect Env Files');
    expect(addBlockOut).toContain('ACTION_BLOCK');

    // 3. List guardrails
    const listOut = runCli(['guardrail', 'list']);
    expect(listOut).toContain('Active Guardrails');
    expect(listOut).toContain('No Hardcoded Secrets');
    expect(listOut).toContain('Protect Env Files');

    // 4. Check safe files -> PASS
    const passCheck = runCli([
      'guardrail',
      'check',
      '--files',
      'src/index.ts,README.md',
      '--agent',
      'codex',
    ]);
    expect(passCheck).toContain('PASS:');

    // 5. Check blocked file -> BLOCKED (throws exit code 1)
    expect(() => {
      runCli([
        'guardrail',
        'check',
        '--files',
        '.env.production',
        '--agent',
        'codex',
      ]);
    }).toThrow();

    // 6. Check blocked file with human bypass -> PASS
    const bypassCheck = runCli([
      'guardrail',
      'check',
      '--files',
      '.env.production',
      '--agent',
      'human',
      '--bypass',
      'Emergency production rotation',
    ]);
    expect(bypassCheck).toContain('PASS:');
    expect(bypassCheck).toContain('bypassed rule(s)');

    // Extract ID of the invariant guardrail to remove it
    const idMatch = addInvOut.match(/Guardrail created \[([^\]]+)\]/);
    expect(idMatch).toBeTruthy();
    const guardrailId = idMatch![1];

    // 7. Remove guardrail
    const removeOut = runCli(['guardrail', 'remove', guardrailId]);
    expect(removeOut).toContain(`Guardrail '${guardrailId}' removed successfully.`);
  });
});

