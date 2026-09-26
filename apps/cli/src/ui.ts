// Lightweight ANSI colors without external dependencies
export const colors = {
  reset: (s: string) => `\x1b[0m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
};

export function banner(): string {
  return colors.cyan(
    `  ____            _            _    ___  ____  \n` +
    ` / ___|___  _ __ | |_ _____  _| |_ / _ \\/ ___| \n` +
    `| |   / _ \\| '_ \\| __/ _ \\ \\/ / __| | | \\___ \\ \n` +
    `| |__| (_) | | | | ||  __/>  <| |_| |_| |___) |\n` +
    ` \\____\\___/|_| |_|\\__\\___/_/\\_\\\\__|\\___/|____/ \n`
  ) + colors.dim(`  Deterministic Context & Handoff Layer for AI Agents\n`);
}

export function logSuccess(msg: string): void {
  console.log(`${colors.green('✔')} ${msg}`);
}

export function logInfo(msg: string): void {
  console.log(`${colors.cyan('ℹ')} ${msg}`);
}

export function logWarning(msg: string): void {
  console.log(`${colors.yellow('⚠')} ${msg}`);
}

export function logError(msg: string): void {
  console.error(`${colors.red('✖')} ${msg}`);
}
