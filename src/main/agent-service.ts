import { app, BrowserWindow } from 'electron';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { IPC } from '../shared/ipc-channels.js';
import type { AppConfig, CollaborationTask } from '../shared/types.js';

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
  always?: boolean;
  reason?: string;
}

/** Pending permission request with Promise resolver */
interface PendingPermission {
  resolve: (result: PermissionResult) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Global pending permission map.
 * Shared between AgentService and the IPC handler in ipc.ts
 * so that PERMISSION_RESPONSE can resolve pending promises.
 */
export const pendingPermissions = new Map<string, PendingPermission>();

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
  getMemoryService(): MemoryServiceInstance | null;
  getTaskRegistry(): TaskRegistryInstance | null;
  setSessionId(sessionId: string): void;
  getSessionId(): string;
}

interface MemoryServiceInstance {
  search(query: string, options?: { limit?: number; scope?: string }): unknown[];
  reconcile(): { added: number; updated: number; removed: number };
}

interface TaskRegistryInstance {
  create(sessionId: string, summary: string, parentId?: string): unknown;
  get(sessionId: string, taskId: string): unknown;
  list(sessionId: string, filter?: { status?: string }): unknown[];
  update(sessionId: string, taskId: string, updates: Record<string, unknown>): unknown;
  start(sessionId: string, taskId: string): unknown;
  block(sessionId: string, taskId: string): unknown;
  unblock(sessionId: string, taskId: string): unknown;
  done(sessionId: string, taskId: string): unknown;
  abandon(sessionId: string, taskId: string): unknown;
  rename(sessionId: string, taskId: string, newSummary: string): unknown;
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
  type: 'text' | 'tool_start' | 'tool_result' | 'done' | 'error' | 'context_pressure' | 'context_overflow';
  content?: string;
  message?: string;
  name?: string;
  result?: { output: string; isError: boolean };
  level?: 0 | 1 | 2 | 3;
  usable?: number;
  current?: number;
  action?: 'auto_compact' | 'manual_required';
}

interface UsageTracker {
  getSessionStats(): SessionStats;
  getLastRecord(): { promptTokens: number; completionTokens: number } | null;
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
type AgentClassType = new (config: unknown, workspace?: string, userDataPath?: string) => AgentInstance;

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
    toolOutput: {
      maxLength: 50_000,
      autoTruncate: true,
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
  private onCollaborationEvent: ((event: 'add' | 'update', task: CollaborationTask) => void) | null = null;
  private onSupervisorCheck: ((toolName: string, output: string, filePath?: string) => void) | null = null;

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  setCollaborationCallback(cb: (event: 'add' | 'update', task: CollaborationTask) => void) {
    this.onCollaborationEvent = cb;
  }

  setSupervisorCallback(cb: (toolName: string, output: string, filePath?: string) => void) {
    this.onSupervisorCheck = cb;
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
      console.debug('[AgentService] Already initialized with same config, skipping');
      return;
    }

    console.debug('[AgentService] Initializing with config:', { model: config.model, apiBase: config.apiBase });

    // Dynamically import mimo-agent (ES Module)
    if (!AgentClass) {
      console.debug('[AgentService] Loading mimo-agent module...');
      try {
        const appRoot = app.isPackaged ? app.getAppPath() : process.cwd();
        const agentPath = join(appRoot, 'engine', 'dist', 'core', 'agent.js');
        const agentUrl = pathToFileURL(agentPath).href;
        console.debug('[AgentService] Loading from:', agentUrl);
        const agentModule = await import(agentUrl);
        AgentClass = agentModule.Agent;
        console.debug('[AgentService] mimo-agent loaded successfully');
      } catch (err) {
        console.error('[AgentService] Failed to load mimo-agent:', err);
        throw err;
      }
    }

    const ws = workspace || this.currentWorkspace || process.cwd();
    this.currentWorkspace = ws;

    const agentConfig = buildAgentConfig(config);
    const userDataPath = app.getPath('userData');

    if (!AgentClass) {
      throw new Error('Agent class not loaded');
    }

    this.agent = new AgentClass(agentConfig, ws, userDataPath);
    console.debug('[AgentService] Agent created, initializing...');
    await this.agent.initialize();

    // Set up permission prompt to use interactive frontend dialog
    const permissionChecker = this.agent.getPermissionChecker();
    if (permissionChecker && this.mainWindow) {
      permissionChecker.setPromptFn(async (request: PermissionRequest) => {
        const window = this.mainWindow;
        if (!window || window.isDestroyed()) return { allowed: true };

        const requestId = randomUUID();

        // Determine risk level for the frontend
        const riskLevel = (request.riskLevel as string) || 'read';

        // Send permission request to renderer
        window.webContents.send(IPC.PERMISSION_REQUEST, {
          id: requestId,
          toolName: request.toolName,
          description: request.description,
          args: request.args,
          riskLevel,
        });

        // Wait for renderer response (with 5-minute timeout)
        return new Promise<PermissionResult>((resolve) => {
          const timeout = setTimeout(() => {
            pendingPermissions.delete(requestId);
            resolve({ allowed: false, reason: 'Permission request timed out' });
          }, 5 * 60 * 1000);

          pendingPermissions.set(requestId, { resolve, timeout });
        });
      });
    }

    this.currentConfig = { ...config };
    console.debug('[AgentService] Agent initialized successfully');
  }

  async run(prompt: string, workspace?: string) {
    console.debug('[AgentService] Running with prompt:', prompt.slice(0, 50));
    if (!this.mainWindow) {
      throw new Error('Agent not initialized');
    }

    // Reinitialize if workspace changed
    if (workspace && workspace !== this.currentWorkspace && this.currentConfig) {
      console.debug('[AgentService] Workspace changed, reinitializing...');
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

    // Track current tool args for supervisor check in onToolResult
    let currentToolFilePath: string | undefined;

    try {
      const generator = this.agent.run(prompt, {
        streaming: true,
        abortSignal: this.abortController.signal,
        onToken: (token: string) => {
          window.webContents.send(IPC.AGENT_TOKEN, token);
        },
        onToolStart: (name: string, args: Record<string, unknown>) => {
          window.webContents.send(IPC.AGENT_TOOL_START, { name, args });

          // Capture file path for supervisor rule checking
          const supervisorTools = new Set(['write_file', 'edit_file', 'shell']);
          if (supervisorTools.has(name)) {
            currentToolFilePath = (args.file_path as string) || (args.path as string) || undefined;
          }

          // Detect sub_agents_run tool call and create collaboration tasks
          if (name === 'sub_agents_run' && this.onCollaborationEvent) {
            const tasks = Array.isArray(args.tasks) ? args.tasks : [];
            for (const task of tasks) {
              if (task && typeof task === 'object' && typeof task.agent === 'string' && typeof task.task === 'string') {
                const collabTask: CollaborationTask = {
                  id: `sa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                  name: task.task.slice(0, 80),
                  agentType: task.agent,
                  status: 'running',
                  prompt: task.task,
                  startTime: Date.now(),
                  toolCalls: 0,
                  inputTokens: 0,
                  outputTokens: 0,
                };
                this.onCollaborationEvent('add', collabTask);
              }
            }
          }
        },
        onToolResult: (name: string, result: { output: string; isError: boolean; metadata?: Record<string, unknown> }) => {
          window.webContents.send(IPC.AGENT_TOOL_RESULT, {
            name,
            output: result.output,
            isError: result.isError,
            truncated: result.metadata?.truncated === true,
            outputPath: result.metadata?.outputPath as string | undefined,
          });

          // Supervisor: check tool output for code quality violations
          const supervisorTools = new Set(['write_file', 'edit_file', 'shell']);
          if (supervisorTools.has(name) && this.onSupervisorCheck) {
            this.onSupervisorCheck(name, result.output, currentToolFilePath);
            currentToolFilePath = undefined;
          }

          // Update collaboration tasks when sub_agents_run completes
          if (name === 'sub_agents_run' && this.onCollaborationEvent) {
            // Mark all running collaboration tasks as completed/failed
            // The result output contains the sub-agent summaries
            this.onCollaborationEvent('update', {
              id: '__complete_all__',
              status: result.isError ? 'failed' : 'completed',
              endTime: Date.now(),
              result: result.isError ? undefined : result.output.slice(0, 500),
              error: result.isError ? result.output.slice(0, 500) : undefined,
            } as CollaborationTask);
          }
        },
      });

      for await (const event of generator) {
        if (event.type === 'done') {
          const tracker = this.agent?.getUsageTracker?.();
          console.debug('[AgentService] UsageTracker:', tracker);
          const stats = tracker?.getSessionStats?.() || {};
          const lastRecord = tracker?.getLastRecord?.();
          console.debug('[AgentService] Session stats:', stats);
          window.webContents.send(IPC.AGENT_DONE, {
            tokens: stats.totalTokens || (stats.promptTokens ?? 0) + (stats.completionTokens ?? 0) || 0,
            cost: stats.totalCost || 0,
            cachedTokens: stats.sessionCachedTokens ?? 0,
            promptTokens: lastRecord?.promptTokens ?? 0,
            completionTokens: stats.completionTokens ?? 0,
          });
        } else if (event.type === 'context_pressure') {
          window.webContents.send(IPC.AGENT_CONTEXT_PRESSURE, {
            level: event.level,
            usable: event.usable,
            current: event.current,
          });
        } else if (event.type === 'context_overflow') {
          window.webContents.send(IPC.AGENT_CONTEXT_OVERFLOW, {
            action: event.action,
          });
        } else if (event.type === 'error') {
          if (this.abortController.signal.aborted) {
            const tracker = this.agent?.getUsageTracker?.();
            const stats = tracker?.getSessionStats?.() || {};
            const lastRecord = tracker?.getLastRecord?.();
            window.webContents.send(IPC.AGENT_DONE, {
              tokens: stats.totalTokens || (stats.promptTokens ?? 0) + (stats.completionTokens ?? 0) || 0,
              cost: stats.totalCost || 0,
              cachedTokens: stats.sessionCachedTokens ?? 0,
              promptTokens: lastRecord?.promptTokens ?? 0,
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
        console.debug('[AgentService] Run stopped');
        const tracker = this.agent?.getUsageTracker?.();
        const stats = tracker?.getSessionStats?.() || {};
        const lastRecord = tracker?.getLastRecord?.();
        window.webContents.send(IPC.AGENT_DONE, {
          tokens: stats.totalTokens || (stats.promptTokens ?? 0) + (stats.completionTokens ?? 0) || 0,
          cost: stats.totalCost || 0,
          cachedTokens: stats.sessionCachedTokens ?? 0,
          promptTokens: lastRecord?.promptTokens ?? 0,
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
