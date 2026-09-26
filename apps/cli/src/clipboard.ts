import { execSync, spawnSync } from 'node:child_process';
import os from 'node:os';

export function copyToClipboard(text: string): boolean {
  const platform = os.platform();

  try {
    if (platform === 'darwin') {
      const child = spawnSync('pbcopy', { input: text, encoding: 'utf-8' });
      return child.status === 0;
    } else if (platform === 'win32') {
      const child = spawnSync('clip', { input: text, encoding: 'utf-8' });
      return child.status === 0;
    } else {
      // Linux / Unix: try xclip then wl-copy
      try {
        const xclip = spawnSync('xclip', ['-selection', 'clipboard'], { input: text, encoding: 'utf-8' });
        if (xclip.status === 0) return true;
      } catch {
        // Fall back to wl-copy
      }

      try {
        const wlCopy = spawnSync('wl-copy', { input: text, encoding: 'utf-8' });
        if (wlCopy.status === 0) return true;
      } catch {
        // No clipboard tool found
      }
    }
  } catch {
    return false;
  }

  return false;
}
