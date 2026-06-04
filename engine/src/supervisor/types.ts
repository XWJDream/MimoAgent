/**
 * Supervisor system types for agent programming oversight
 */

export type Severity = 'info' | 'warning' | 'error';

export interface SupervisorRule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  check: (context: SupervisorContext) => SupervisorResult | null;
}

export interface SupervisorContext {
  toolName: string;
  args: Record<string, unknown>;
  result?: {
    output: string;
    isError: boolean;
  };
  conversation: Array<{
    role: string;
    content: string | null;
  }>;
  fileChanges?: FileChange[];
}

export interface FileChange {
  path: string;
  type: 'create' | 'modify' | 'delete';
  linesAdded?: number;
  linesRemoved?: number;
}

export interface SupervisorResult {
  ruleId: string;
  severity: Severity;
  message: string;
  suggestion?: string;
}

export interface SupervisorEvent {
  type: 'violation';
  result: SupervisorResult;
  timestamp: number;
}
