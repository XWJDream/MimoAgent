// IPC Channel types
export interface IpcChannels {
  // Agent
  'agent:run': (prompt: string) => void;
  'agent:stop': () => void;
  'agent:clear': () => void;
  'agent:token': (token: string) => void;
  'agent:tool-start': (tool: { name: string; args: Record<string, unknown> }) => void;
  'agent:tool-result': (result: { name: string; output: string; isError: boolean }) => void;
  'agent:done': (usage: { tokens: number; cost: number; cachedTokens?: number }) => void;
  'agent:error': (error: string) => void;
  'agent:thinking': () => void;

  // Config
  'config:get': () => PublicAppConfig;
  'config:set': (key: string, value: unknown) => PublicAppConfig;

  // Workspace
  'workspace:get': () => WorkspaceInfo;
  'workspace:set': (path: string) => WorkspaceInfo;
  'workspace:select': () => WorkspaceInfo | null;

  // Sessions
  'session:list': () => Session[];
  'session:create': (name?: string) => Session;
  'session:switch': (id: string) => void;
  'session:delete': (id: string) => void;
  'session:rename': (id: string, name: string) => void;
  'session:set-workspace': (id: string, path: string) => Session;

  // File
  'file:list': (path?: string) => FileTreeNode[];
  'file:read': (path: string) => string;
  'file:write': (path: string, content: string) => void;
  'file:dialog': () => string | null;

  // Shell
  'shell:exec': (command: string) => ShellResult;

  // Window
  'window:minimize': () => void;
  'window:maximize': () => void;
  'window:close': () => void;

  // TTS
  'tts:generate': (params: { text: string; model: string; voice?: string; speed?: number }) => { success: boolean; audioBase64?: string; error?: string };
}

export interface AppConfig {
  model: string;
  apiBase: string;
  apiKey: string;
  permissionMode: 'suggest' | 'auto-edit' | 'full-auto';
  toolPreset: 'plan' | 'act';
  maxTurns: number;
  temperature: number;
  reasoningEffort: 'low' | 'medium' | 'high';
  theme: 'dark' | 'light';
  selectedAvatarId: string;
  sandboxEnabled: boolean;
}

export interface PublicAppConfig extends Omit<AppConfig, 'apiKey'> {
  apiKeyConfigured: boolean;
  apiKeyPreview: string | null;
}

export interface WorkspaceInfo {
  path: string;
  name: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

export interface Session {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  workspacePath?: string;
  workspaceName?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: ToolCallInfo[];
  toolResult?: ToolResultInfo;
  usage?: { tokens: number; cost: number; cachedTokens?: number };
}

export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  output?: string;
  duration?: number;
}

export interface ToolResultInfo {
  name: string;
  output: string;
  isError: boolean;
}

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface UsageStats {
  sessionTokens: number;
  sessionCost: number;
  sessionToolCalls: number;
  sessionCachedTokens: number;
  sessionPromptTokens: number;
  sessionCompletionTokens: number;
  totalTokens: number;
  totalCost: number;
  totalToolCalls: number;
  /** Latest turn's prompt tokens (for context window display, not cumulative) */
  currentPromptTokens: number;
}

export type SubagentStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface SubagentInfo {
  id: string;
  name: string;
  prompt: string;
  status: SubagentStatus;
  toolCalls: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  latestToolCall?: string;
  result?: string;
  error?: string;
  startTime?: number;
  endTime?: number;
}

export interface PermissionRequest {
  id: string;
  toolName: string;
  riskLevel: string;
  description: string;
  args: Record<string, unknown>;
}

export interface PermissionResponse {
  id: string;
  allowed: boolean;
  remember?: boolean;
}

// Plugin & Automation types
export interface ToolInfo {
  name: string;
  description: string;
  riskLevel: string;
  categories: string[];
  parameterCount: number;
}

export interface McpServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: {
    type: 'file-change' | 'message-count' | 'manual' | 'schedule';
    config: Record<string, unknown>;
  };
  action: {
    type: 'run-prompt' | 'run-tool' | 'notify';
    config: Record<string, unknown>;
  };
}

export interface AutomationExecution {
  id: string;
  ruleId: string;
  ruleName: string;
  timestamp: number;
  success: boolean;
  output?: string;
  duration?: number;
}
