import type { PermissionMode } from '../config/types.js';
import type { RiskLevel } from '../tools/base.js';
import type { AgentMode } from './agent-rules.js';
import { wildcardMatch } from './wildcard.js';
import { evaluate, type Ruleset } from './evaluator.js';
import { getAgentRules } from './agent-rules.js';

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

/** External permission prompt function type */
export type PermissionPromptFn = (request: PermissionRequest) => Promise<PermissionResult>;

export class PermissionChecker {
  private mode: PermissionMode;
  private agentMode: AgentMode;
  private sessionOverrides: Map<string, boolean> = new Map();
  private userRules: PathPermissionRule[] = [];
  private agentRuleset: Ruleset;
  private userRuleset: Ruleset;
  private externalPromptFn: PermissionPromptFn | null = null;

  constructor(
    mode: PermissionMode,
    userRules?: PathPermissionRule[],
    promptFn?: PermissionPromptFn,
    agentMode?: AgentMode,
  ) {
    this.mode = mode;
    this.userRules = userRules || [];
    this.externalPromptFn = promptFn || null;
    this.agentMode = agentMode ?? 'build';
    this.agentRuleset = getAgentRules(this.agentMode);
    this.userRuleset = [];
  }

  /**
   * Set an external prompt function for permission requests.
   * This allows Electron GUI to handle permission dialogs instead of TTY prompts.
   */
  setPromptFn(fn: PermissionPromptFn): void {
    this.externalPromptFn = fn;
  }

  setMode(mode: PermissionMode): void {
    this.mode = mode;
  }

  getMode(): PermissionMode {
    return this.mode;
  }

  /**
   * 设置 Agent 模式，自动加载对应的规则集
   */
  setAgentMode(agentMode: AgentMode): void {
    this.agentMode = agentMode;
    this.agentRuleset = getAgentRules(agentMode);
  }

  getAgentMode(): AgentMode {
    return this.agentMode;
  }

  setUserRules(rules: PathPermissionRule[]): void {
    this.userRules = rules;
  }

  /**
   * 设置用户自定义的评估器规则集（通配符规则）
   */
  setUserRuleset(rules: Ruleset): void {
    this.userRuleset = rules;
  }

  async check(request: PermissionRequest): Promise<PermissionResult> {
    // Check session overrides first
    const key = `${request.toolName}:${JSON.stringify(request.args)}`;
    if (this.sessionOverrides.has(key)) {
      return { allowed: this.sessionOverrides.get(key)! };
    }

    // Extract file path for path-based rules
    const filePath = extractFilePath(request.toolName, request.args);

    if (filePath) {
      // 1. 先检查敏感路径规则（最高优先级，使用通配符匹配）
      for (const rule of SENSITIVE_PATH_RULES) {
        if (
          wildcardMatch(filePath, rule.pattern) &&
          (rule.tools.length === 0 || rule.tools.includes(request.toolName))
        ) {
          if (rule.action === 'deny') {
            return {
              allowed: false,
              reason: rule.description || `Path ${filePath} is protected`,
            };
          }
          if (rule.action === 'confirm') {
            return this.promptUser({
              ...request,
              description: rule.description || request.description,
            });
          }
        }
      }

      // 2. 检查用户路径规则
      for (const rule of this.userRules) {
        if (
          wildcardMatch(filePath, rule.pattern) &&
          (rule.tools.length === 0 || rule.tools.includes(request.toolName))
        ) {
          if (rule.action === 'deny') {
            return {
              allowed: false,
              reason: rule.description || `Path ${filePath} is protected by user rule`,
            };
          }
          if (rule.action === 'confirm') {
            return this.promptUser({
              ...request,
              description: rule.description || request.description,
            });
          }
          if (rule.action === 'allow') {
            return { allowed: true };
          }
        }
      }

      // 3. 使用评估器检查 Agent 规则 + 用户评估器规则
      const rule = evaluate(
        request.toolName,
        filePath,
        this.agentRuleset,
        this.userRuleset,
      );

      if (rule.action === 'deny') {
        return {
          allowed: false,
          reason: `Path ${filePath} is denied by agent policy`,
        };
      }
      if (rule.action === 'allow') {
        return { allowed: true };
      }
      // action === 'ask' → fall through to mode-based logic
    }

    // 对于没有文件路径的请求，使用 Agent 规则 + 用户规则评估
    const rule = evaluate(
      request.toolName,
      '*',
      this.agentRuleset,
      this.userRuleset,
    );

    if (rule.action === 'deny') {
      return { allowed: false, reason: `Permission ${request.toolName} is denied by policy` };
    }
    if (rule.action === 'allow') {
      return { allowed: true };
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
    // Use external prompt function if available (e.g., Electron GUI)
    if (this.externalPromptFn) {
      const result = await this.externalPromptFn(request);
      if (result.allowed) {
        const key = `${request.toolName}:${JSON.stringify(request.args)}`;
        this.sessionOverrides.set(key, true);
      }
      return result;
    }

    // In non-interactive mode (non-TTY), auto-allow
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
        // Use the same key format as in check() method
        const key = `${request.toolName}:${JSON.stringify(request.args)}`;
        this.sessionOverrides.set(key, true);
      }

      return { allowed, reason: allowed ? undefined : 'User denied' };
    } catch {
      return { allowed: true };
    }
  }
}
