import { describe, it, expect } from 'vitest';
import { SecretScanner, DiffFilter, GitClient } from '../src/index.js';

describe('@contextos/git Test Suite', () => {
  describe('SecretScanner', () => {
    it('detects and redacts OpenAI API keys', () => {
      const input = 'const apiKey = "sk-proj-abc1234567890abcdef1234567890";';
      const result = SecretScanner.scanAndRedact(input);

      expect(result.hasSecrets).toBe(true);
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.findings[0].type).toBe('OpenAI API Key');
      expect(result.redacted).not.toContain('sk-proj-abc1234567890abcdef1234567890');
      expect(result.redacted).toContain('[REDACTED SECRET DETECTED]');
    });

    it('detects and redacts GitHub Personal Access Tokens', () => {
      const input = 'GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz12';
      const result = SecretScanner.scanAndRedact(input);

      expect(result.hasSecrets).toBe(true);
      expect(result.findings[0].type).toBe('GitHub Token');
      expect(result.redacted).toBe('GITHUB_TOKEN=[REDACTED SECRET DETECTED]');
    });

    it('detects and redacts AWS Access Keys', () => {
      const input = 'aws_access_key_id = AKIAIOSFODNN7EXAMPLE';
      const result = SecretScanner.scanAndRedact(input);

      expect(result.hasSecrets).toBe(true);
      expect(result.findings[0].type).toBe('AWS Access Key');
      expect(result.redacted).toContain('[REDACTED SECRET DETECTED]');
    });

    it('detects and redacts multiline RSA Private Keys', () => {
      const input = `
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y1K...
...fake_key_content...
-----END RSA PRIVATE KEY-----
      `;
      const result = SecretScanner.scanAndRedact(input);

      expect(result.hasSecrets).toBe(true);
      expect(result.findings[0].type).toBe('Private Key Header');
      expect(result.redacted).toContain('[REDACTED SECRET DETECTED: Private Key]');
      expect(result.redacted).not.toContain('fake_key_content');
    });

    it('leaves safe code unmodified', () => {
      const input = 'function calculateTotal(items: Item[]) { return items.reduce((a, b) => a + b.price, 0); }';
      const result = SecretScanner.scanAndRedact(input);

      expect(result.hasSecrets).toBe(false);
      expect(result.redacted).toBe(input);
      expect(result.findings).toHaveLength(0);
    });
  });

  describe('DiffFilter (Noise Exclusion & Line Budgeting)', () => {
    it('identifies lockfiles as noisy', () => {
      expect(DiffFilter.isNoisyFile('package-lock.json').isNoisy).toBe(true);
      expect(DiffFilter.isNoisyFile('pnpm-lock.yaml').isNoisy).toBe(true);
      expect(DiffFilter.isNoisyFile('yarn.lock').isNoisy).toBe(true);
      expect(DiffFilter.isNoisyFile('Cargo.lock').isNoisy).toBe(true);
    });

    it('identifies build artifacts and binaries as noisy', () => {
      expect(DiffFilter.isNoisyFile('dist/bundle.js').isNoisy).toBe(true);
      expect(DiffFilter.isNoisyFile('apps/web/.next/cache.js').isNoisy).toBe(true);
      expect(DiffFilter.isNoisyFile('public/logo.png').isNoisy).toBe(true);
      expect(DiffFilter.isNoisyFile('bundle.min.js').isNoisy).toBe(true);
    });

    it('allows legitimate source code files', () => {
      expect(DiffFilter.isNoisyFile('src/index.ts').isNoisy).toBe(false);
      expect(DiffFilter.isNoisyFile('packages/core/models/task.ts').isNoisy).toBe(false);
      expect(DiffFilter.isNoisyFile('README.md').isNoisy).toBe(false);
    });

    it('truncates large single-file diffs over the line limit', () => {
      const lines = ['diff --git a/big.ts b/big.ts'];
      for (let i = 0; i < 300; i++) {
        lines.push(`+ const line${i} = ${i};`);
      }
      const rawHunk = lines.join('\n');

      const filtered = DiffFilter.filterAndBudgetDiff('src/big.ts', rawHunk, { maxLinesPerFile: 50 });
      expect(filtered.isTruncated).toBe(true);
      expect(filtered.isExcluded).toBe(false);
      expect(filtered.diff).toContain('File diff truncated: 251 lines omitted');
    });

    it('applies global budget capping across multiple files', () => {
      const file1 = DiffFilter.filterAndBudgetDiff(
        'src/f1.ts',
        Array.from({ length: 40 }, (_, i) => `+ line ${i}`).join('\n')
      );
      const file2 = DiffFilter.filterAndBudgetDiff(
        'src/f2.ts',
        Array.from({ length: 40 }, (_, i) => `+ line ${i}`).join('\n')
      );
      const file3 = DiffFilter.filterAndBudgetDiff(
        'src/f3.ts',
        Array.from({ length: 40 }, (_, i) => `+ line ${i}`).join('\n')
      );

      const budgeted = DiffFilter.applyGlobalBudget([file1, file2, file3], 70);
      expect(budgeted).toHaveLength(3);
      expect(budgeted[0].isTruncated).toBe(false);
      expect(budgeted[2].isTruncated).toBe(true);
      expect(budgeted[2].diff).toContain('Global diff budget');
    });
  });

  describe('GitClient (Live Repository Inspection)', () => {
    const git = new GitClient();

    it('confirms the current workspace is a git repo', () => {
      expect(git.isGitRepo()).toBe(true);
    });

    it('retrieves the repository root path', () => {
      const root = git.getRepoRoot();
      expect(root).toContain('ContextOS');
    });

    it('retrieves current branch name and HEAD commit', () => {
      const branch = git.getCurrentBranch();
      expect(branch).toBe('master');

      const head = git.getHeadCommit();
      expect(head).not.toBeNull();
      expect(head?.hash).toBeDefined();
      expect(head?.shortHash).toBeDefined();
    });

    it('retrieves git status', () => {
      const status = git.getStatus();
      expect(status.branch).toBe('master');
      expect(Array.isArray(status.modified)).toBe(true);
      expect(Array.isArray(status.added)).toBe(true);
    });

    it('extracts filtered context without throwing', () => {
      const context = git.getFilteredContext();
      expect(context.repoRoot).toBeDefined();
      expect(context.branch).toBe('master');
      expect(Array.isArray(context.diffs)).toBe(true);
      expect(typeof context.hasSecretsDetected).toBe('boolean');
    });
  });
});
