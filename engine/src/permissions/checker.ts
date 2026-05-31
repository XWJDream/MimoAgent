import type { PermissionMode } from '../config/types.js';
import type { RiskLevel } from '../tools/base.js';

export interface PermissionRequest {
  toolName: string;
  args: Record<string, unknown>;
  riskLevel: RiskLevel;
  description: string;
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

export interface PathPermissionRule {
  /** Glob-like pattern to match file paths (supports * and **) */
  pattern: string;
  /** Tool names this rule applies to. Empty = all tools */
  tools: string[];
  /** 'allow' = auto-approve, 'deny' = auto-deny, 'confirm' = always ask */
  action: 'allow' | 'deny' | 'confirm';
  /** Optional description for the prompt */
  description?: string;
}

/**
 * Default path rules for sensitive files.
 * These are always applied regardless of user config.
 */
const SENSITIVE_PATH_RULES: PathPermissionRule[] = [
  {
    pattern: '**/.env*',
    tools: ['write_file', 'edit_file', 'shell'],
    action: 'confirm',
    description: 'Modifying environment files may expose secrets',
  },
  {
    pattern: '**/.git/**',
    tools: ['write_file', 'edit_file', 'shell'],
    action: 'deny',
    description: 'Direct .git manipulation is not allowed',
  },
  {
    pattern: '**/node_modules/**',
    tools: ['write_file', 'edit_file', 'shell'],
    action: 'deny',
    description: 'Modifying node_modules is not allowed',
  },
];

function matchPattern(pattern: string, filePath: string): boolean {
  // Normalize paths
  const normalizedPattern = pattern.replace(/\\/g, '/');
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Simple glob matching
  if (normalizedPattern === '**') return true;

  // Convert glob to regex
  let regexStr = normalizedPattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');

  regexStr = `^${regexStr}$`;

  try {
    return new RegExp(regexStr).test(normalizedPath);
  } catch {
    return false;
  }
}

/**
 * Extract the primary file path from tool arguments.
 */
function extractFilePath(_toolName: string, args: Record<string, unknown>): string | null {
  // Common argument names for file paths
  const pathKeys = ['file_path', 'path', 'command'];
  for (const key of pathKeys) {
    if (typeof args[key] === 'string' && args[key]) {
      const val = args[key] as string;
      // For shell commands, try to extract file paths
      if (key === 'command') {
        // Simple heuristic: extract first argument that looks like a path
        const match = val.match(/(?:^|\s)([^\s]*[/\\][^\s]*)/);
        return match ? match[1] : null;
      }
      return val;
    }
  }
  return null;
}

export class PermissionChecker {
  private mode: PermissionMode;
  private sessionOverrides: Map<string, boolean> = new Map();
  private userRules: PathPermissionRule[] = [];

  constructor(mode: PermissionMode, userRules?: PathPermissionRule[]) {
    this.mode = mode;
    this.userRules = userRules || [];
  }

  setMode(mode: PermissionMode): void {
    this.mode = mode;
  }

  getMode(): PermissionMode {
    return this.mode;
  }

  setUserRules(rules: PathPermissionRule[]): void {
    this.userRules = rules;
  }

  async check(request: PermissionRequest): Promise<PermissionResult> {
    // Check session overrides first
    const key = `${request.toolName}:${JSON.stringify(request.args)}`;
    if (this.sessionOverrides.has(key)) {
      return { allowed: this.sessionOverrides.get(key)! };
    }

    // Check path-based rules
    const filePath = extractFilePath(request.toolName, request.args);
    if (filePath) {
      // Check sensitive path rules first (always enforced)
      for (const rule of SENSITIVE_PATH_RULES) {
        if (matchPattern(rule.pattern, filePath) &&
            (rule.tools.length === 0 || rule.tools.includes(request.toolName))) {
          if (rule.action === 'deny') {
            return { allowed: false, reason: rule.description || `Path ${filePath} is protected` };
          }
          if (rule.action === 'confirm') {
            // Fall through to promptUser, but include the rule description
            return this.promptUser({ ...request, description: rule.description || request.description });
          }
          // 'allow' = continue to next rule
        }
      }

      // Check user-defined rules
      for (const rule of this.userRules) {
        if (matchPattern(rule.pattern, filePath) &&
            (rule.tools.length === 0 || rule.tools.includes(request.toolName))) {
          if (rule.action === 'deny') {
            return { allowed: false, reason: rule.description || `Path ${filePath} is protected by user rule` };
          }
          if (rule.action === 'confirm') {
            return this.promptUser({ ...request, description: rule.description || request.description });
          }
          if (rule.action === 'allow') {
            return { allowed: true };
          }
        }
      }
    }

    // Fall back to mode-based logic
    switch (this.mode) {
      case 'suggest':
        return this.promptUser(request);

      case 'auto-edit':
        if (request.riskLevel === 'read') return { allowed: true };
        if (request.riskLevel === 'write') return { allowed: true };
        return this.promptUser(request);

      case 'full-auto':
        if (request.riskLevel === 'destructive') return this.promptUser(request);
        return { allowed: true };
    }
  }

  private async promptUser(request: PermissionRequest): Promise<PermissionResult> {
    // In a real implementation, this would use inquirer
    // For now, auto-allow in non-interactive mode
    if (!process.stdin.isTTY) {
      return { allowed: true };
    }

    // Dynamic import to avoid issues in non-interactive environments
    try {
      const { confirm } = await import('@inquirer/prompts');
      const allowed = await confirm({
        message: `Allow ${request.toolName}? ${request.description}`,
        default: false,
      });

      if (allowed) {
        this.sessionOverrides.set(JSON.stringify({ tool: request.toolName, args: request.args }), true);
      }

      return { allowed, reason: allowed ? undefined : 'User denied' };
    } catch {
      return { allowed: true };
    }
  }
}
