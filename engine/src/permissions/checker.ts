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

export class PermissionChecker {
  private mode: PermissionMode;
  private sessionOverrides: Map<string, boolean> = new Map();

  constructor(mode: PermissionMode) {
    this.mode = mode;
  }

  setMode(mode: PermissionMode): void {
    this.mode = mode;
  }

  getMode(): PermissionMode {
    return this.mode;
  }

  async check(request: PermissionRequest): Promise<PermissionResult> {
    // Check session overrides
    const key = `${request.toolName}:${JSON.stringify(request.args)}`;
    if (this.sessionOverrides.has(key)) {
      return { allowed: this.sessionOverrides.get(key)! };
    }

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
