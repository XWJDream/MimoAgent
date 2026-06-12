import type { ToolDefinition } from '../tools/schema.js';
import type { ToolResult } from '../tools/base.js';

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  main: string;           // Entry file path
  hooks?: string[];       // Declared hook types
}

export interface PluginContext {
  workingDirectory: string;
  config: Record<string, unknown>;
  logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export interface PluginHooks {
  /** Called when config changes */
  onConfigChange?: (config: Record<string, unknown>) => void | Promise<void>;

  /** Called when tool definition changes (can modify tool description/params) */
  onToolDefinition?: (tool: ToolDefinition) => ToolDefinition | Promise<ToolDefinition>;

  /** Called before tool execution */
  onBeforeTool?: (name: string, args: Record<string, unknown>) =>
    Promise<{ skip?: boolean; modifiedArgs?: Record<string, unknown> } | void>;

  /** Called after tool execution */
  onAfterTool?: (name: string, result: ToolResult) =>
    Promise<{ modifiedResult?: ToolResult } | void>;

  /** Called when agent starts */
  onAgentStart?: () => void | Promise<void>;

  /** Called when agent ends */
  onAgentEnd?: () => void | Promise<void>;

  /** Shell environment variable injection */
  onShellEnv?: () => Record<string, string> | Promise<Record<string, string>>;
}

export interface Plugin {
  manifest: PluginManifest;
  hooks: PluginHooks;
  context: PluginContext;
  enabled: boolean;
  loadedAt: number;
}

export interface PluginDefinition {
  manifest: PluginManifest;
  hooks: PluginHooks;
}

/** Plugin info for IPC (serializable) */
export interface PluginInfo {
  name: string;
  version: string;
  description?: string;
  author?: string;
  enabled: boolean;
  loadedAt: number;
  hooks: string[];
}
