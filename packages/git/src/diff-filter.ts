import * as path from 'node:path';

export interface FilteredFileDiff {
  filePath: string;
  additions: number;
  deletions: number;
  diff: string;
  isTruncated: boolean;
  isExcluded: boolean;
  exclusionReason?: string;
}

export interface DiffFilterOptions {
  maxLinesPerFile?: number;
  maxTotalLines?: number;
}

export class DiffFilter {
  private static readonly IGNORED_EXACT_FILES = new Set([
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'Cargo.lock',
    'poetry.lock',
    'Gemfile.lock',
    'composer.lock',
    '.DS_Store',
  ]);

  private static readonly IGNORED_DIRECTORY_PREFIXES = [
    'node_modules/',
    'dist/',
    'build/',
    '.next/',
    'out/',
    'target/',
    '.contextos/',
    '.git/',
  ];

  private static readonly IGNORED_EXTENSIONS = new Set([
    '.min.js',
    '.min.css',
    '.map',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.ico',
    '.svg',
    '.wasm',
    '.zip',
    '.tar.gz',
    '.db',
    '.db-wal',
    '.db-shm',
  ]);

  public static isNoisyFile(filePath: string): { isNoisy: boolean; reason?: string } {
    const normalized = filePath.replace(/\\/g, '/');
    const baseName = path.basename(normalized);

    if (this.IGNORED_EXACT_FILES.has(baseName)) {
      return { isNoisy: true, reason: 'Lockfile or system metadata' };
    }

    for (const prefix of this.IGNORED_DIRECTORY_PREFIXES) {
      if (normalized.startsWith(prefix) || normalized.includes('/' + prefix)) {
        return { isNoisy: true, reason: `Build artifact or dependency folder (${prefix})` };
      }
    }

    for (const ext of this.IGNORED_EXTENSIONS) {
      if (normalized.endsWith(ext)) {
        return { isNoisy: true, reason: `Binary or generated minified asset (${ext})` };
      }
    }

    return { isNoisy: false };
  }

  public static filterAndBudgetDiff(
    filePath: string,
    rawHunk: string,
    options: DiffFilterOptions = {}
  ): FilteredFileDiff {
    const { maxLinesPerFile = 150 } = options;
    const noisyCheck = this.isNoisyFile(filePath);

    const lines = rawHunk.split('\n');
    let additions = 0;
    let deletions = 0;

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }

    if (noisyCheck.isNoisy) {
      return {
        filePath,
        additions,
        deletions,
        diff: `[Excluded ${noisyCheck.reason}: +${additions}, -${deletions} lines]`,
        isTruncated: false,
        isExcluded: true,
        exclusionReason: noisyCheck.reason,
      };
    }

    if (lines.length > maxLinesPerFile) {
      const truncatedLines = lines.slice(0, maxLinesPerFile);
      const omitted = lines.length - maxLinesPerFile;
      const truncatedDiff = [
        ...truncatedLines,
        `... [File diff truncated: ${omitted} lines omitted (+${additions}, -${deletions} total)]`,
      ].join('\n');

      return {
        filePath,
        additions,
        deletions,
        diff: truncatedDiff,
        isTruncated: true,
        isExcluded: false,
      };
    }

    return {
      filePath,
      additions,
      deletions,
      diff: rawHunk,
      isTruncated: false,
      isExcluded: false,
    };
  }

  public static applyGlobalBudget(
    fileDiffs: FilteredFileDiff[],
    maxTotalLines = 1000
  ): FilteredFileDiff[] {
    let currentLineCount = 0;
    const budgeted: FilteredFileDiff[] = [];

    for (const fileDiff of fileDiffs) {
      if (fileDiff.isExcluded) {
        budgeted.push(fileDiff);
        continue;
      }

      const diffLines = fileDiff.diff.split('\n').length;
      if (currentLineCount + diffLines <= maxTotalLines) {
        budgeted.push(fileDiff);
        currentLineCount += diffLines;
      } else {
        const remainingLinesBudget = maxTotalLines - currentLineCount;
        if (remainingLinesBudget >= 20) {
          const lines = fileDiff.diff.split('\n');
          const partialLines = lines.slice(0, remainingLinesBudget);
          budgeted.push({
            ...fileDiff,
            diff: [
              ...partialLines,
              `... [Global diff budget limit reached: +${fileDiff.additions}, -${fileDiff.deletions} lines]`,
            ].join('\n'),
            isTruncated: true,
          });
          currentLineCount = maxTotalLines;
        } else {
          budgeted.push({
            ...fileDiff,
            diff: `[Diff omitted: Global diff budget reached (+${fileDiff.additions}, -${fileDiff.deletions} lines)]`,
            isTruncated: true,
          });
        }
      }
    }

    return budgeted;
  }
}
