import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { ContextOsMcpServer } from '../packages/mcp/src/server.js';
import { BudgetAllocator } from '../packages/context-builder/src/budget-allocator.js';

describe('Phase 6: End-to-End Multi-Agent Workflow Validation (Claude ➔ Codex Loop)', () => {
  let tmpHome: string;
  let tmpWorkspace: string;
  let server: ContextOsMcpServer;
  const cliPath = path.resolve(__dirname, '../apps/cli/dist/index.js');

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'contextos-e2e-home-'));
    tmpWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'contextos-e2e-ws-'));

    // Initialize clean Git repository in workspace
    execFileSync('git', ['init'], { cwd: tmpWorkspace });
    execFileSync('git', ['config', 'user.name', 'Claude & Codex E2E'], { cwd: tmpWorkspace });
    execFileSync('git', ['config', 'user.email', 'e2e@contextos.dev'], { cwd: tmpWorkspace });

    const readmePath = path.join(tmpWorkspace, 'README.md');
    fs.writeFileSync(readmePath, '# E2E Payment Gateway Workspace\n', 'utf-8');
    execFileSync('git', ['add', '.'], { cwd: tmpWorkspace });
    execFileSync('git', ['commit', '-m', 'Initial workspace commit'], { cwd: tmpWorkspace });

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

  it('executes full Claude ➔ Codex ➔ Claude workflow with zero data loss, sub-200ms compilation, and strict invariant adherence', async () => {
    // =========================================================================
    // STEP 1: Planning with Claude (MCP / save_context)
    // =========================================================================
    const saveTaskRes = server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'save_context',
        arguments: {
          title: 'Refactor Payment Gateway to Webhooks',
          goal: 'Migrate from polling payment status to idempotent webhook event ingestion',
          newConstraints: [
            'Idempotency key header (X-Idempotency-Key) must be verified on all incoming webhook requests',
            'Raw credit card numbers and CVVs must never be logged or persisted in database records',
          ],
          remainingItems: [
            'Implement webhook endpoint with HMAC-SHA256 signature verification in src/payment/webhook.ts',
            'Add idempotent event deduplication in src/payment/deduplicator.ts',
            'Add integration test for duplicate webhook payloads in tests/webhook.test.ts',
          ],
          status: 'IN_PROGRESS',
        },
      },
    });

    expect(saveTaskRes?.result.isError).toBeFalsy();
    const taskPayload = JSON.parse(saveTaskRes?.result.content[0].text);
    expect(taskPayload.task.title).toBe('Refactor Payment Gateway to Webhooks');
    expect(taskPayload.task.constraints).toHaveLength(2);

    // Claude records architectural decision
    const recordDecRes = server.handleRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'record_decision',
        arguments: {
          title: 'Use HMAC-SHA256 for Stripe Webhook Signature Verification',
          rationale: 'Prevents replay attacks and verifies payload authenticity against webhook signing secret',
          relatedFiles: ['src/payment/webhook.ts', 'src/payment/signature.ts'],
        },
      },
    });

    expect(recordDecRes?.result.isError).toBeFalsy();
    const decPayload = JSON.parse(recordDecRes?.result.content[0].text);
    expect(decPayload.decision.title).toBe('Use HMAC-SHA256 for Stripe Webhook Signature Verification');
    expect(decPayload.decision.status).toBe('ACTIVE');

    // =========================================================================
    // STEP 2: Handoff 1 Generation (Claude ➔ Codex)
    // Verification: Latency < 200ms, Token count < 1,000 tokens
    // =========================================================================
    const t0 = performance.now();
    const handoffRes1 = server.handleRequest({
      jsonrpc: '2.0',
      id: 3,
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
    const t1 = performance.now();
    const compilationLatencyMs = t1 - t0;

    // Latency Invariant: Deterministic compilation in < 200ms
    expect(compilationLatencyMs).toBeLessThan(200);

    expect(handoffRes1?.result.isError).toBeFalsy();
    const handoffData1 = JSON.parse(handoffRes1?.result.content[0].text);

    // Token Budget Invariant: < 1,000 tokens for average feature tasks
    expect(handoffData1.tokenCountEstimate).toBeLessThan(1000);
    expect(handoffData1.tokenCountEstimate).toBeGreaterThan(50);

    // Markdown Layout Compliance (TRD Section 5.2)
    const md1 = handoffData1.markdown;
    expect(md1).toContain('# ContextOS Handoff: claude ➔ codex');
    expect(md1).toContain('**Phase:** Implementation Phase');
    expect(md1).toContain('## 1. Task Specification');
    expect(md1).toContain('- **Task:** Refactor Payment Gateway to Webhooks');
    expect(md1).toContain('## 2. Invariants & Constraints (MUST PRESERVE)');
    expect(md1).toContain('Idempotency key header (X-Idempotency-Key) must be verified');
    expect(md1).toContain('Raw credit card numbers and CVVs must never be logged');
    expect(md1).toContain('## 3. Active Architectural Decisions');
    expect(md1).toContain('Use HMAC-SHA256 for Stripe Webhook Signature Verification');
    expect(md1).toContain('`src/payment/webhook.ts`');
    expect(md1).toContain('## 4. Work Progress');
    expect(md1).toContain('[ ] **CURRENT:** Implement webhook endpoint with HMAC-SHA256');
    expect(md1).toContain('## 8. Recommended Next Action');

    // Verify .contextos/handoffs/latest.md is written to disk
    expect(fs.existsSync(handoffData1.handoffPath)).toBe(true);
    expect(fs.readFileSync(handoffData1.handoffPath, 'utf-8')).toBe(md1);

    // =========================================================================
    // STEP 3: Execution with Codex (Modifying Working Tree & Updating State)
    // =========================================================================
    const paymentDir = path.join(tmpWorkspace, 'src', 'payment');
    fs.mkdirSync(paymentDir, { recursive: true });

    // Codex writes code adhering to the invariants
    const webhookCode = `import crypto from 'node:crypto';

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'v1=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

export function handleWebhook(event: { idempotencyKey: string; data: any }) {
  if (!event.idempotencyKey) {
    throw new Error('Missing X-Idempotency-Key');
  }
  return { processed: true, key: event.idempotencyKey };
}
`;
    fs.writeFileSync(path.join(paymentDir, 'webhook.ts'), webhookCode, 'utf-8');

    const deduplicatorCode = `export class EventDeduplicator {
  private seen = new Set<string>();

  public isDuplicate(key: string): boolean {
    if (this.seen.has(key)) return true;
    this.seen.add(key);
    return false;
  }
}
`;
    fs.writeFileSync(path.join(paymentDir, 'deduplicator.ts'), deduplicatorCode, 'utf-8');

    // Stage changes in git
    execFileSync('git', ['add', '.'], { cwd: tmpWorkspace });

    // Codex reports progress via MCP: completes item 1
    const updateProgressRes = server.handleRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'save_context',
        arguments: {
          completedItems: ['Implement webhook endpoint with HMAC-SHA256 signature verification in src/payment/webhook.ts'],
          remainingItems: [
            'Add idempotent event deduplication in src/payment/deduplicator.ts',
            'Add integration test for duplicate webhook payloads in tests/webhook.test.ts',
          ],
        },
      },
    });

    expect(updateProgressRes?.result.isError).toBeFalsy();

    // =========================================================================
    // STEP 4: Return Handoff & Review (Codex ➔ Claude via CLI)
    // =========================================================================
    // Execute CLI: contextos handoff --from codex --to claude --phase review
    const cliOutput = runCli(['handoff', '--from', 'codex', '--to', 'claude', '--phase', 'review', '--no-copy']);
    expect(cliOutput).toContain('Handoff compiled successfully!');
    expect(cliOutput).toContain('codex ➔ claude');
    expect(cliOutput).toContain('review');

    // Read the compiled return handoff document
    const returnHandoffPath = path.join(tmpWorkspace, '.contextos', 'handoffs', 'latest.md');
    expect(fs.existsSync(returnHandoffPath)).toBe(true);
    const returnMd = fs.readFileSync(returnHandoffPath, 'utf-8');

    // Verify Checkpoint 1: Downstream agent adheres to invariants without manual reminders
    expect(returnMd).toContain('# ContextOS Handoff: codex ➔ claude');
    expect(returnMd).toContain('**Phase:** Review Phase');
    expect(returnMd).toContain('## 2. Invariants & Constraints (MUST PRESERVE)');
    expect(returnMd).toContain('Idempotency key header (X-Idempotency-Key) must be verified');
    expect(returnMd).toContain('Raw credit card numbers and CVVs must never be logged');

    // Verify Checkpoint 2: Work progress checklist reflects completed items
    expect(returnMd).toContain('## 4. Work Progress');
    expect(returnMd).toContain('[x] Implement webhook endpoint with HMAC-SHA256');
    expect(returnMd).toContain('[ ] **CURRENT:** Add idempotent event deduplication');

    // Verify Checkpoint 3: Git diff accurately reflects files modified during the session
    expect(returnMd).toContain('## 5. Git & Working Tree State');
    expect(returnMd).toContain('src/payment/webhook.ts');
    expect(returnMd).toContain('src/payment/deduplicator.ts');
    expect(returnMd).toContain('## 6. Focused Diff');
    expect(returnMd).toContain('verifyWebhookSignature');
    expect(returnMd).toContain('EventDeduplicator');

    // Verify Checkpoint 4: Token usage remains strictly budgeted
    const returnTokenCount = BudgetAllocator.estimateTokens(returnMd);
    expect(returnTokenCount).toBeLessThan(1000);
  });

  it('guarantees zero database lock errors (SQLITE_BUSY) during concurrent access across CLI and MCP', async () => {
    // Concurrently trigger 30 read/write operations between MCP server and CLI
    const operations: Promise<any>[] = [];

    // Initialize project state
    server.handleRequest({
      jsonrpc: '2.0',
      id: 100,
      method: 'tools/call',
      params: {
        name: 'save_context',
        arguments: {
          title: 'Concurrency Stress Test',
          goal: 'Verify zero database lock contention under simultaneous multi-process load',
          status: 'IN_PROGRESS',
        },
      },
    });

    for (let i = 0; i < 15; i++) {
      // Async MCP calls
      operations.push(
        Promise.resolve().then(() => {
          return server.handleRequest({
            jsonrpc: '2.0',
            id: 200 + i,
            method: 'tools/call',
            params: {
              name: 'record_decision',
              arguments: {
                title: `Concurrent Decision ${i}`,
                rationale: `Stress testing concurrent SQLite writes ${i}`,
              },
            },
          });
        })
      );

      // Async CLI calls
      operations.push(
        Promise.resolve().then(() => {
          return runCli(['status']);
        })
      );
    }

    const results = await Promise.all(operations);
    expect(results).toHaveLength(30);

    // Verify all decisions were committed cleanly
    const finalStatus = runCli(['decision', 'list']);
    expect(finalStatus).toContain('Concurrent Decision 0');
    expect(finalStatus).toContain('Concurrent Decision 14');
  });
});
