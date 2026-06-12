export type PermissionMode = 'suggest' | 'auto-edit' | 'full-auto';

export type AgentMode = 'build' | 'plan' | 'explore';

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

export interface ToolOutputConfig {
  /** Maximum allowed character length for tool output (default 50000) */
  maxLength?: number;
  /** Whether auto-truncation is enabled (default true) */
  autoTruncate?: boolean;
}

export type ToolPreset = 'plan' | 'act';

export interface McpServerEntry {
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
  timeout?: number;
}

export interface McpConfig {
  servers?: Record<string, McpServerEntry>;
}

export interface PathPermissionRule {
  pattern: string;
  tools: string[];
  action: 'allow' | 'deny' | 'confirm';
  description?: string;
}

/** 模型信息 */
export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
  costPer1kInput?: number;
  costPer1kOutput?: number;
}

/** 单个 Provider 配置 */
export interface ProviderConfig {
  /** 当前使用的 Provider 名称（如 'mimo', 'openai', 'anthropic', 'openai-compatible'） */
  name?: string;
  /** 自定义模型列表 */
  models?: ModelInfo[];
  /** 默认模型 */
  defaultModel?: string;
}

/** 多 Provider 配置（按名称索引） */
export type ProvidersConfig = Record<string, {
  apiKey?: string;
  baseUrl?: string;
  models?: ModelInfo[];
}>;

export interface MimoConfig {
  model: string;
  apiBase: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
  contextWindow: number;
  permissionMode: PermissionMode;
  agentMode?: AgentMode;
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
  toolOutput?: ToolOutputConfig;
  mcp?: McpConfig;
  /** 单 Provider 配置 */
  provider?: ProviderConfig;
  /** 多 Provider 配置（按名称索引） */
  providers?: ProvidersConfig;
}
