import { app, BrowserWindow, dialog } from 'electron';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { IPC } from '../shared/ipc-channels.js';
import type { AppConfig } from '../shared/types.js';

/** Permission request from engine */
interface PermissionRequest {
  toolName: string;
  args: Record<string, unknown>;
  riskLevel: string;
  description: string;
}

/** Permission result */
interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

/** Permission checker interface */
interface PermissionChecker {
  setPromptFn(fn: (request: PermissionRequest) => Promise<PermissionResult>): void;
}

/** Agent instance interface - matches engine/src/core/agent.ts Agent class */
interface AgentInstance {
  initialize(): Promise<void>;
  run(prompt: string, options?: AgentRunOptions): AsyncGenerator<AgentEvent>;
  clearConversation(): void;
  getUsageTracker(): UsageTracker;
  getToolRegistry(): ToolRegistry;
  getPermissionChecker(): PermissionChecker | null;
  getConversation(): unknown[];
  setConversation(messages: unknown[]): void;
  getMemory(): ProjectMemory;
}

interface ProjectMemory {
  getContent(): string;
  setContent(content: string): void;
  save(): Promise<void>;
}

interface AgentRunOptions {
  streaming?: boolean;
  abortSignal?: AbortSignal;
  maxTurns?: number;
  onToken?: (token: string) => void;
  onToolStart?: (name: string, args: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: { output: string; isError: boolean }) => void;
}

interface AgentEvent {
  type: 'text' | 'tool_start' | 'tool_result' | 'done' | 'error';
  content?: string;
  message?: string;
  name?: string;
  result?: { output: string; isError: boolean };
}

interface UsageTracker {
  getSessionStats(): SessionStats;
}

interface SessionStats {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  sessionCachedTokens: number;
  sessionToolCalls: number;
}

interface ToolRegistry {
  getAll(): ToolInfo[];
}

interface ToolInfo {
  name: string;
  description?: string;
  riskLevel?: string;
  categories?: string[];
  parameters?: unknown;
}

/** Agent class constructor type */
type AgentClassType = new (config: unknown, workspace?: string) => AgentInstance;

// Dynamic import for mimo-agent (compiled JS)
let AgentClass: AgentClassType | null = null;
type AgentRuntimeConfig = Pick<AppConfig, 'apiKey' | 'apiBase' | 'model' | 'permissionMode' | 'toolPreset' | 'maxTurns' | 'temperature' | 'sandboxEnabled' | 'reasoningEffort'>;

export function buildAgentConfig(config: AgentRuntimeConfig) {
  return {
    model: config.model,
    apiBase: config.apiBase,
    apiKey: config.apiKey,
    maxTokens: 4096,
    temperature: config.temperature,
    reasoningEffort: config.reasoningEffort || 'medium',
    contextWindow: 128000,
    permissionMode: config.permissionMode,
    toolPreset: config.toolPreset,
    allowedTools: [],
    blockedTools: [],
    allowedPaths: [],
    maxTurns: config.maxTurns,
    disableDefaultTools: [],
    sandbox: {
      enabled: config.sandboxEnabled,
      image: '',
      memoryLimit: '512m',
      cpuLimit: 1,
      networkEnabled: false,
      timeout: 30000,
    },
    theme: 'dark',
    stream: true,
    verbose: false,
    subAgents: {
      enabled: config.toolPreset === 'act',
      maxConcurrent: 3,
    },
  };
}

export class AgentService {
  private agent: AgentInstance | null = null;
  private mainWindow: BrowserWindow | null = null;
  private currentConfig: AgentRuntimeConfig | null = null;
  private currentWorkspace: string = '';
  private abortController: AbortController | null = null;
  private isRunning = false;

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  async initialize(config: AgentRuntimeConfig, workspace?: string) {
    // Skip if already initialized with same config and workspace
    if (this.agent && this.currentConfig &&
        this.currentConfig.apiKey === config.apiKey &&
        this.currentConfig.apiBase === config.apiBase &&
        this.currentConfig.model === config.model &&
        this.currentConfig.permissionMode === config.permissionMode &&
        this.currentConfig.toolPreset === config.toolPreset &&
        this.currentConfig.maxTurns === config.maxTurns &&
        this.currentConfig.temperature === config.temperature &&
        this.currentConfig.sandboxEnabled === config.sandboxEnabled &&
        (!workspace || workspace === this.currentWorkspace)) {
      console.log('[AgentService] Already initialized with same config, skipping');
      return;
    }

    console.log('[AgentService] Initializing with config:', { model: config.model, apiBase: config.apiBase });

    // Dynamically import mimo-agent (ES Module)
    if (!AgentClass) {
      console.log('[AgentService] Loading mimo-agent module...');
      try {
        const appRoot = app.isPackaged ? app.getAppPath() : process.cwd();
        const agentPath = join(appRoot, 'engine', 'dist', 'core', 'agent.js');
        const agentUrl = pathToFileURL(agentPath).href;
        console.log('[AgentService] Loading from:', agentUrl);
        const agentModule = await import(agentUrl);
        AgentClass = agentModule.Agent;
        console.log('[AgentService] mimo-agent loaded successfully');
      } catch (err) {
        console.error('[AgentService] Failed to load mimo-agent:', err);
        throw err;
      }
    }

    const ws = workspace || this.currentWorkspace || process.cwd();
    this.currentWorkspace = ws;

    const agentConfig = buildAgentConfig(config);

    if (!AgentClass) {
      throw new Error('Agent class not loaded');
    }

    this.agent = new AgentClass(agentConfig, ws);
    console.log('[AgentService] Agent created, initializing...');
    await this.agent.initialize();

    // Set up permission prompt to use Electron native dialog
    const permissionChecker = this.agent.getPermissionChecker();
    if (permissionChecker && this.mainWindow) {
      permissionChecker.setPromptFn(async (request: PermissionRequest) => {
        const window = this.mainWindow;
        if (!window) return { allowed: true };

        const result = await dialog.showMessageBox(window, {
          type: 'question',
          buttons: ['允许', '拒绝'],
          defaultId: 1,
          title: '权限请求',
          message: `是否允许执行操作？`,
          detail: `工具: ${request.toolName}\n风险级别: ${request.riskLevel}\n\n${request.description}`,
          cancelId: 1,
          noLink: true,
        });

        return { allowed: result.response === 0 };
      });
    }

    this.currentConfig = { ...config };
    console.log('[AgentService] Agent initialized successfully');
  }

  async run(prompt: string, workspace?: string) {
    console.log('[AgentService] Running with prompt:', prompt.slice(0, 50));
    if (!this.mainWindow) {
      throw new Error('Agent not initialized');
    }

    // Reinitialize if workspace changed
    if (workspace && workspace !== this.currentWorkspace && this.currentConfig) {
      console.log('[AgentService] Workspace changed, reinitializing...');
      this.agent = null;
      await this.initialize(this.currentConfig, workspace);
    }

    if (!this.agent) {
      if (this.currentConfig) {
        await this.initialize(this.currentConfig, workspace);
      }
      if (!this.agent) {
        throw new Error('Agent not initialized');
      }
    }

    const window = this.mainWindow;
    this.abortController?.abort();
    this.abortController = new AbortController();
    this.isRunning = true;

    // Send thinking event
    window.webContents.send(IPC.AGENT_THINKING);

    try {
      const generator = this.agent.run(prompt, {
        streaming: true,
        abortSignal: this.abortController.signal,
        onToken: (token: string) => {
          window.webContents.send(IPC.AGENT_TOKEN, token);
        },
        onToolStart: (name: string, args: Record<string, unknown>) => {
          window.webContents.send(IPC.AGENT_TOOL_START, { name, args });
        },
        onToolResult: (name: string, result: { output: string; isError: boolean }) => {
          window.webContents.send(IPC.AGENT_TOOL_RESULT, {
            name,
            output: result.output,
            isError: result.isError,
          });
        },
      });

      for await (const event of generator) {
        if (event.type === 'done') {
          const tracker = this.agent?.getUsageTracker?.();
          console.log('[AgentService] UsageTracker:', tracker);
          const stats = tracker?.getSessionStats?.() || {};
          console.log('[AgentService] Session stats:', stats);
          window.webContents.send(IPC.AGENT_DONE, {
            tokens: stats.totalTokens || (stats.promptTokens ?? 0) + (stats.completionTokens ?? 0) || 0,
            cost: stats.totalCost || 0,
            cachedTokens: stats.sessionCachedTokens ?? 0,
            promptTokens: stats.promptTokens ?? 0,
            completionTokens: stats.completionTokens ?? 0,
          });
        } else if (event.type === 'error') {
          if (this.abortController.signal.aborted) {
            const tracker = this.agent?.getUsageTracker?.();
            const stats = tracker?.getSessionStats?.() || {};
            window.webContents.send(IPC.AGENT_DONE, {
              tokens: stats.totalTokens || (stats.promptTokens ?? 0) + (stats.completionTokens ?? 0) || 0,
              cost: stats.totalCost || 0,
              cachedTokens: stats.sessionCachedTokens ?? 0,
              promptTokens: stats.promptTokens ?? 0,
              completionTokens: stats.completionTokens ?? 0,
            });
          } else {
            window.webContents.send(IPC.AGENT_ERROR, event.message);
          }
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (this.abortController?.signal.aborted || message.includes('aborted') || message.includes('AbortError')) {
        console.log('[AgentService] Run stopped');
        const tracker = this.agent?.getUsageTracker?.();
        const stats = tracker?.getSessionStats?.() || {};
        window.webContents.send(IPC.AGENT_DONE, {
          tokens: stats.totalTokens || (stats.promptTokens ?? 0) + (stats.completionTokens ?? 0) || 0,
          cost: stats.totalCost || 0,
          cachedTokens: stats.sessionCachedTokens ?? 0,
          promptTokens: stats.promptTokens ?? 0,
          completionTokens: stats.completionTokens ?? 0,
        });
      } else {
        console.error('[AgentService] Exception:', message);
        window.webContents.send(IPC.AGENT_ERROR, message);
      }
    } finally {
      this.isRunning = false;
      this.abortController = null;
    }
  }

  stop() {
    if (!this.isRunning || !this.abortController) return;
    this.abortController.abort();
  }

  clear() {
    this.agent?.clearConversation();
  }

  getAgent(): AgentInstance | null {
    return this.agent;
  }
}
