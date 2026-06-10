/**
 * Supervisor Rule Engine
 *
 * Defines a set of code quality rules that check tool outputs for common issues.
 * Each rule has a unique ID, human-readable name, severity level, and a check function.
 */

export interface SupervisorRule {
  id: string;
  name: string;
  severity: 'info' | 'warning' | 'error';
  check: (content: string, context: SupervisorContext) => string | null;
}

export interface SupervisorContext {
  filePath?: string;
  toolName?: string;
}

export interface Violation {
  ruleId: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  suggestion?: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Rule: no-hardcoded-secrets (error)
// Detects common hardcoded secret patterns such as API keys, passwords, tokens.
// ---------------------------------------------------------------------------
const noHardcodedSecrets: SupervisorRule = {
  id: 'no-hardcoded-secrets',
  name: 'No Hardcoded Secrets',
  severity: 'error',
  check(content: string): string | null {
    const patterns: Array<{ re: RegExp; label: string }> = [
      // OpenAI / generic sk- prefixed keys
      { re: /(?:^|[^A-Za-z0-9])sk-[A-Za-z0-9]{20,}/g, label: 'API key (sk-...)' },
      // Generic api_key / apiKey / API_KEY assignment
      { re: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][A-Za-z0-9\-_.]{16,}['"]/gi, label: 'API key assignment' },
      // password= or PASSWORD= assignments
      { re: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{6,}['"]/gi, label: 'Password assignment' },
      // token= assignments (Bearer, PAT, etc.)
      { re: /(?:token|secret|access_token|refresh_token)\s*[:=]\s*['"][A-Za-z0-9\-_.]{16,}['"]/gi, label: 'Token/secret assignment' },
      // AWS access key
      { re: /(?:^|[^A-Za-z0-9])AKIA[0-9A-Z]{16}(?:[^A-Za-z0-9]|$)/g, label: 'AWS access key' },
      // Private key block
      { re: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g, label: 'Private key block' },
    ];

    for (const { re, label } of patterns) {
      // Reset regex lastIndex for global patterns
      re.lastIndex = 0;
      if (re.test(content)) {
        return `Detected hardcoded secret: ${label}. Use environment variables or a secrets manager instead.`;
      }
    }
    return null;
  },
};

// ---------------------------------------------------------------------------
// Rule: no-dangerous-commands (error)
// Detects dangerous shell commands that could cause irreversible damage.
// ---------------------------------------------------------------------------
const noDangerousCommands: SupervisorRule = {
  id: 'no-dangerous-commands',
  name: 'No Dangerous Commands',
  severity: 'error',
  check(content: string): string | null {
    const patterns: Array<{ pattern: RegExp; desc: string }> = [
      { pattern: /rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\s+[/~]/, desc: 'Recursive force delete from root/home' },
      { pattern: /rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\s+\*/, desc: 'Recursive force delete with wildcard' },
      { pattern: /\bmkfs\b/, desc: 'Filesystem format command' },
      { pattern: /\bdd\s+if=/, desc: 'Raw disk write (dd)' },
      { pattern: /:\(\)\{.*\|.*&\};\s*:/, desc: 'Fork bomb' },
      { pattern: /curl\s+[^|]*\|\s*(?:ba)?sh/, desc: 'Pipe remote script to shell' },
      { pattern: /wget\s+[^|]*\|\s*(?:ba)?sh/, desc: 'Pipe remote script to shell' },
      { pattern: /chmod\s+-R\s+777\s+\//, desc: 'Recursive 777 on root' },
      { pattern: />\s*\/dev\/sd[a-z]/, desc: 'Overwrite block device' },
      { pattern: /\bformat\s+[A-Za-z]:/i, desc: 'Windows format drive' },
      { pattern: /\bdel\s+\/[a-zA-Z]*\s+[A-Z]:\\/i, desc: 'Windows recursive delete' },
      { pattern: /\brd\s+\/s\s+\/q\s+[A-Z]:\\/i, desc: 'Windows remove directory tree' },
    ];

    for (const { pattern, desc } of patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        return `Dangerous command detected: ${desc}. This command could cause irreversible damage.`;
      }
    }
    return null;
  },
};

// ---------------------------------------------------------------------------
// Rule: max-file-length (warning)
// Warns when a file exceeds 500 lines.
// ---------------------------------------------------------------------------
const maxFileLength: SupervisorRule = {
  id: 'max-file-length',
  name: 'Max File Length',
  severity: 'warning',
  check(content: string): string | null {
    const lineCount = content.split('\n').length;
    if (lineCount > 500) {
      return `File has ${lineCount} lines (limit: 500). Consider splitting into smaller modules.`;
    }
    return null;
  },
};

// ---------------------------------------------------------------------------
// Rule: no-console-in-prod (warning)
// Detects console.log statements in TypeScript / JavaScript source files.
// ---------------------------------------------------------------------------
const noConsoleInProd: SupervisorRule = {
  id: 'no-console-in-prod',
  name: 'No Console in Production',
  severity: 'warning',
  check(content: string, context: SupervisorContext): string | null {
    // Only apply to JS/TS files
    const ext = context.filePath?.match(/\.(tsx?|jsx?)$/i)?.[0];
    if (!ext) return null;

    // Match console.log but allow console.warn / console.error (those are fine)
    const re = /\bconsole\s*\.\s*log\s*\(/g;
    const matches = content.match(re);
    if (matches && matches.length > 0) {
      return `Found ${matches.length} console.log statement(s) in ${context.filePath}. Use a proper logger or remove before production.`;
    }
    return null;
  },
};

// ---------------------------------------------------------------------------
// Rule: no-todo-fixme (info)
// Detects TODO / FIXME / HACK comments.
// ---------------------------------------------------------------------------
const noTodoFixme: SupervisorRule = {
  id: 'no-todo-fixme',
  name: 'No TODO/FIXME',
  severity: 'info',
  check(content: string): string | null {
    const re = /(?:\/\/|\/\*|#|<!--)\s*(TODO|FIXME|HACK|XXX)\b[^\n]*/gi;
    const matches = content.match(re);
    if (matches && matches.length > 0) {
      return `Found ${matches.length} TODO/FIXME/HACK comment(s): ${matches[0].trim().slice(0, 120)}`;
    }
    return null;
  },
};

// ---------------------------------------------------------------------------
// Rule: no-large-function (warning)
// Detects functions exceeding 100 lines. Uses a simple brace-counting heuristic.
// ---------------------------------------------------------------------------
const noLargeFunction: SupervisorRule = {
  id: 'no-large-function',
  name: 'No Large Functions',
  severity: 'warning',
  check(content: string): string | null {
    // Match function declarations / arrow functions / method definitions
    const funcStartRe = /(?:(?:export\s+)?(?:async\s+)?function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(|(?:public|private|protected|static)\s+(?:async\s+)?\w+\s*\(|(?:async\s+)?\w+\s*\([^)]*\)\s*\{)/g;

    let match: RegExpExecArray | null;
    while ((match = funcStartRe.exec(content)) !== null) {
      const startIndex = match.index;
      // Count lines from the match to find the function body
      const beforeMatch = content.slice(0, startIndex);
      const startLine = beforeMatch.split('\n').length;

      // Find the opening brace
      const openBraceIdx = content.indexOf('{', startIndex);
      if (openBraceIdx === -1) continue;

      // Count braces to find the matching closing brace
      let depth = 0;
      let endIdx = -1;
      for (let i = openBraceIdx; i < content.length; i++) {
        if (content[i] === '{') depth++;
        else if (content[i] === '}') {
          depth--;
          if (depth === 0) {
            endIdx = i;
            break;
          }
        }
      }

      if (endIdx === -1) continue;

      const funcBody = content.slice(openBraceIdx, endIdx + 1);
      const lineCount = funcBody.split('\n').length;

      if (lineCount > 100) {
        // Extract function name for the message
        const nameMatch = match[0].match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)|(\w+)\s*\()/);
        const funcName = nameMatch?.[1] || nameMatch?.[2] || nameMatch?.[3] || 'anonymous';
        return `Function "${funcName}" at line ${startLine} has ${lineCount} lines (limit: 100). Consider breaking it into smaller functions.`;
      }
    }
    return null;
  },
};

// ---------------------------------------------------------------------------
// Exported rule set and runner
// ---------------------------------------------------------------------------

export const RULES: SupervisorRule[] = [
  noHardcodedSecrets,
  noDangerousCommands,
  maxFileLength,
  noConsoleInProd,
  noTodoFixme,
  noLargeFunction,
];

/**
 * Run all rules against the given content and return any violations found.
 */
export function runRules(
  content: string,
  context: SupervisorContext = {},
): Violation[] {
  if (!content) return [];

  const violations: Violation[] = [];
  for (const rule of RULES) {
    const message = rule.check(content, context);
    if (message) {
      violations.push({
        ruleId: rule.id,
        severity: rule.severity,
        message,
        timestamp: Date.now(),
      });
    }
  }
  return violations;
}
