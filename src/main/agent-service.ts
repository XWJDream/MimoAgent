import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { IPC } from '../shared/ipc-channels.js';
import type { AppConfig } from '../shared/types.js';

// Dynamic import for mimo-agent (compiled JS)
let AgentClass: any = null;
type AgentRuntimeConfig = Pick<AppConfig, 'apiKey' | 'apiBase' | 'model' | 'permissionMode' | 'maxTurns' | 'temperature' | 'sandboxEnabled'>;

export class AgentService {
  private agent: any = null;
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

    const agentConfig = {
      model: config.model,
      apiBase: config.apiBase,
      apiKey: config.apiKey,
      maxTokens: 4096,
      temperature: config.temperature,
      contextWindow: 128000,
      permissionMode: config.permissionMode,
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
        enabled: false,
        maxConcurrent: 1,
      },
    };

    this.agent = new AgentClass(agentConfig, ws);
    console.log('[AgentService] Agent created, initializing...');
    await this.agent.initialize();
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
          const stats = tracker?.getSessionStats?.() || {};
          window.webContents.send(IPC.AGENT_DONE, {
            tokens: stats.totalTokens || (stats.promptTokens ?? 0) + (stats.completionTokens ?? 0) || 0,
            cost: stats.totalCost || 0,
          });
        } else if (event.type === 'error') {
          if (this.abortController.signal.aborted) {
            const tracker = this.agent?.getUsageTracker?.();
            const stats = tracker?.getSessionStats?.() || {};
            window.webContents.send(IPC.AGENT_DONE, {
              tokens: stats.totalTokens || (stats.promptTokens ?? 0) + (stats.completionTokens ?? 0) || 0,
              cost: stats.totalCost || 0,
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

  getAgent() {
    return this.agent;
  }
}
