import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { DiffFilter, type FilteredFileDiff, type DiffFilterOptions } from './diff-filter.js';
import { SecretScanner, type SecretFinding } from './secret-scanner.js';

export interface HeadCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitStatusResult {
  branch: string;
  isDirty: boolean;
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
}

export interface GitCommitSummary {
  hash: string;
  shortHash: string;
  message: string;
  date: string;
}

export interface GitContextResult {
  repoRoot: string;
  branch: string;
  head: HeadCommit | null;
  status: GitStatusResult;
  recentCommits: GitCommitSummary[];
  diffs: FilteredFileDiff[];
  hasSecretsDetected: boolean;
  secretFindings: SecretFinding[];
  totalDiffLines: number;
}

export class GitClient {
  constructor(private readonly cwd: string = process.cwd()) {}

  private execGit(args: string[]): string {
    try {
      const output = execFileSync('git', args, {
        cwd: this.cwd,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return output.trim();
    } catch (err: any) {
      const stderr = err.stderr ? err.stderr.toString().trim() : '';
      throw new Error(`Git command failed ('git ${args.join(' ')}'): ${stderr || err.message}`);
    }
  }

  public isGitRepo(): boolean {
    try {
      this.execGit(['rev-parse', '--is-inside-work-tree']);
      return true;
    } catch {
      return false;
    }
  }

  public getRepoRoot(): string {
    return this.execGit(['rev-parse', '--show-toplevel']);
  }

  public getCurrentBranch(): string {
    try {
      const branch = this.execGit(['rev-parse', '--abbrev-ref', 'HEAD']);
      return branch === 'HEAD' ? 'detached' : branch;
    } catch {
      return 'unknown';
    }
  }

  public getHeadCommit(): HeadCommit | null {
    try {
      const output = this.execGit(['log', '-1', '--format=%H%x1f%h%x1f%an%x1f%ad%x1f%s']);
      if (!output) return null;
      const [hash, shortHash, author, date, message] = output.split('\x1f');
      return { hash, shortHash, author, date, message };
    } catch {
      return null;
    }
  }

  public getStatus(): GitStatusResult {
    const branch = this.getCurrentBranch();
    const rawStatus = this.execGit(['status', '--porcelain=v1']);

    const modified: string[] = [];
    const added: string[] = [];
    const deleted: string[] = [];
    const untracked: string[] = [];

    if (!rawStatus) {
      return { branch, isDirty: false, modified, added, deleted, untracked };
    }

    const lines = rawStatus.split('\n');
    for (const line of lines) {
      if (!line) continue;
      const statusCode = line.slice(0, 2);
      const filePath = line.slice(3).trim();

      if (statusCode === '??') {
        untracked.push(filePath);
      } else if (statusCode.includes('D')) {
        deleted.push(filePath);
      } else if (statusCode.includes('A') || statusCode.includes('R')) {
        added.push(filePath);
      } else {
        modified.push(filePath);
      }
    }

    return {
      branch,
      isDirty: modified.length > 0 || added.length > 0 || deleted.length > 0,
      modified,
      added,
      deleted,
      untracked,
    };
  }

  public getRecentCommits(limit = 5): GitCommitSummary[] {
    try {
      const output = this.execGit(['log', `-n`, limit.toString(), '--format=%H%x1f%h%x1f%s%x1f%ad']);
      if (!output) return [];

      return output.split('\n').filter(Boolean).map((line) => {
        const [hash, shortHash, message, date] = line.split('\x1f');
        return { hash, shortHash, message, date };
      });
    } catch {
      return [];
    }
  }

  public getFilteredContext(
    options: DiffFilterOptions & { baseCommit?: string; files?: string[] } = {}
  ): GitContextResult {
    const repoRoot = this.getRepoRoot();
    const branch = this.getCurrentBranch();
    const head = this.getHeadCommit();
    const status = this.getStatus();
    const recentCommits = this.getRecentCommits(5);

    const diffArgs = ['diff', '-U3'];
    if (options.baseCommit) {
      diffArgs.push(options.baseCommit);
    }
    if (options.files && options.files.length > 0) {
      diffArgs.push('--', ...options.files);
    }

    let rawDiff = '';
    try {
      rawDiff = this.execGit(diffArgs);
    } catch {
      rawDiff = '';
    }

    const fileDiffs: FilteredFileDiff[] = [];
    const allFindings: SecretFinding[] = [];

    if (rawDiff) {
      const diffSegments = rawDiff.split(/^diff --git /m).filter(Boolean);

      for (const segment of diffSegments) {
        const lines = segment.split('\n');
        const header = lines[0];
        const match = header.match(/^[ab]\/(.+?)\s+[ab]\/(.+?)$/);
        const filePath = match ? match[2] : header.split(' ')[1] || 'unknown';

        const scanResult = SecretScanner.scanAndRedact('diff --git ' + segment);
        if (scanResult.hasSecrets) {
          allFindings.push(...scanResult.findings);
        }

        const filtered = DiffFilter.filterAndBudgetDiff(filePath, scanResult.redacted, options);
        fileDiffs.push(filtered);
      }
    }

    const budgetedDiffs = DiffFilter.applyGlobalBudget(fileDiffs, options.maxTotalLines ?? 1000);
    const totalDiffLines = budgetedDiffs.reduce((sum, d) => sum + d.diff.split('\n').length, 0);

    return {
      repoRoot,
      branch,
      head,
      status,
      recentCommits,
      diffs: budgetedDiffs,
      hasSecretsDetected: allFindings.length > 0,
      secretFindings: allFindings,
      totalDiffLines,
    };
  }
}
