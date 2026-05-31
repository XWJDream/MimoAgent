export type PermissionMode = 'suggest' | 'auto-edit' | 'full-auto';

export interface SandboxConfig {
  enabled: boolean;
  image: string;
  memoryLimit: string;
  cpuLimit: number;
  networkEnabled: boolean;
  timeout: number;
}

export interface SubAgentConfig {
  enabled: boolean;
  maxConcurrent: number;
}

export type ToolPreset = 'plan' | 'act';

export interface PathPermissionRule {
  pattern: string;
  tools: string[];
  action: 'allow' | 'deny' | 'confirm';
  description?: string;
}

export interface MimoConfig {
  model: string;
  apiBase: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
  contextWindow: number;
  permissionMode: PermissionMode;
  toolPreset?: ToolPreset;
  pathPermissionRules?: PathPermissionRule[];
  allowedTools: string[];
  blockedTools: string[];
  allowedPaths: string[];
  maxTurns: number;
  systemPromptAppend?: string;
  disableDefaultTools: string[];
  sandbox: SandboxConfig;
  theme: 'dark' | 'light';
  stream: boolean;
  verbose: boolean;
  subAgents: SubAgentConfig;
}
