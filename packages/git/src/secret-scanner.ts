export interface SecretFinding {
  type: string;
  matched: string;
  line: number;
}

export interface ScanResult {
  hasSecrets: boolean;
  redacted: string;
  findings: SecretFinding[];
}

export class SecretScanner {
  private static readonly PATTERNS: { type: string; regex: RegExp }[] = [
    {
      type: 'Private Key Header',
      regex: /-----BEGIN (?:[A-Z0-9_-]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9_-]+ )?PRIVATE KEY-----/g,
    },
    {
      type: 'OpenAI API Key',
      regex: /sk-[a-zA-Z0-9_\-]{20,}/g,
    },
    {
      type: 'GitHub Token',
      regex: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/g,
    },
    {
      type: 'AWS Access Key',
      regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    },
    {
      type: 'Generic API Key / Secret',
      regex: /(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"]([a-zA-Z0-9_\-]{16,})['"]/gi,
    },
  ];

  public static scanAndRedact(content: string): ScanResult {
    const findings: SecretFinding[] = [];
    let redacted = content;

    // First scan full block patterns like multi-line private keys
    for (const pattern of this.PATTERNS) {
      if (pattern.type === 'Private Key Header') {
        redacted = redacted.replace(pattern.regex, (match) => {
          findings.push({
            type: pattern.type,
            matched: match.slice(0, 30) + '...',
            line: 1,
          });
          return '[REDACTED SECRET DETECTED: Private Key]';
        });
      }
    }

    // Line-by-line scanning for single-line tokens
    const lines = redacted.split('\n');
    const processedLines = lines.map((line, index) => {
      let currentLine = line;

      for (const pattern of this.PATTERNS) {
        if (pattern.type === 'Private Key Header') continue;

        if (pattern.type === 'Generic API Key / Secret') {
          currentLine = currentLine.replace(pattern.regex, (fullMatch, secretVal) => {
            findings.push({
              type: pattern.type,
              matched: secretVal,
              line: index + 1,
            });
            return fullMatch.replace(secretVal, '[REDACTED SECRET DETECTED]');
          });
        } else {
          currentLine = currentLine.replace(pattern.regex, (match) => {
            findings.push({
              type: pattern.type,
              matched: match,
              line: index + 1,
            });
            return '[REDACTED SECRET DETECTED]';
          });
        }
      }

      return currentLine;
    });

    return {
      hasSecrets: findings.length > 0,
      redacted: processedLines.join('\n'),
      findings,
    };
  }
}
