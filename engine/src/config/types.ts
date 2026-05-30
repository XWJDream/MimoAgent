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

export interface MimoConfig {
  model: string;
  apiBase: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
  contextWindow: number;
  permissionMode: PermissionMode;
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
