import type { MimoConfig } from '../config/types.js';
import type { ChatMessage } from '../llm/types.js';
import { LLMClient } from '../llm/client.js';
import { ToolRegistry } from '../tools/registry.js';
import { registerBuiltinTools, MemorySearchTool } from '../tools/builtin/index.js';
import { PermissionChecker } from '../permissions/checker.js';
import { agentLoop, type LoopEvent, type AgentLoopOptions, type AgentHooks } from './agent-loop.js';
import { buildSystemPrompt } from '../context/system-prompt.js';
import { ProjectMemory } from '../context/memory.js';
import { FileCache } from '../context/file-cache.js';
import { UsageTracker } from '../context/usage-tracker.js';
import { shouldCompact, compactMessages, estimateConversationTokens } from '../context/compaction.js';
import { SandboxManager } from '../sandbox/manager.js';
import { MemoryService } from '../memory/service.js';
import { TaskRegistry } from '../task/registry.js';
import { McpManager } from '../mcp/index.js';
import { McpToolAdapter } from '../tools/mcp-adapter.js';
import { PluginRegistry } from '../plugin/index.js';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export class Agent {
  private config: MimoConfig;
  private llmClient: LLMClient;
  private toolRegistry: ToolRegistry;
  private permissionChecker: PermissionChecker | null = null;
  private sandboxManager: SandboxManager | null = null;
  private conversation: ChatMessage[] = [];
  private memory: ProjectMemory;
  private fileCache: FileCache;
  private usageTracker: UsageTracker;
  private workspace: string;
  private hooks: AgentHooks | undefined;
  private initialized = false;
  private memoryService: MemoryService | null = null;
  private memorySearchTool: MemorySearchTool | null = null;
  private userDataPath: string;
  private taskRegistry: TaskRegistry | null = null;
  private sessionId: string = 'default';
  private pluginRegistry: PluginRegistry | null = null;
  private mcpManager: McpManager | null = null;

  constructor(config: MimoConfig, workspace?: string, userDataPath?: string) {
    this.config = config;
    this.workspace = workspace || process.cwd();
    this.userDataPath = userDataPath || workspace || process.cwd();
    this.llmClient = new LLMClient({
      apiKey: config.apiKey,
      baseUrl: config.apiBase,
      model: config.model,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
      timeout: 60000,
      reasoningEffort: config.reasoningEffort,
    });
    this.toolRegistry = new ToolRegistry();
    this.memory = new ProjectMemory(this.workspace);
    this.fileCache = new FileCache();
    this.usageTracker = new UsageTracker();
    if (config.sandbox?.enabled) {
      this.sandboxManager = new SandboxManager(config.sandbox, true);
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load project memory and usage history
    await Promise.all([this.memory.load(), this.usageTracker.load()]);

    // Initialize memory service (SQLite FTS5)
    try {
      const { join } = await import('node:path');
      const memoryRoot = join(this.userDataPath, 'memory');
      this.memoryService = new MemoryService(this.userDataPath, memoryRoot);
      this.memorySearchTool = new MemorySearchTool();
      this.memorySearchTool.setMemoryService(this.memoryService);

      // Initial reconcile: sync disk memory files with database
      const result = this.memoryService.reconcile();
      console.log(`[Agent] Memory reconciled: +${result.added} ~${result.updated} -${result.removed}`);
    } catch (err) {
      console.warn('[Agent] Memory service init failed, continuing without FTS memory:', err);
    }

    // Initialize task registry (SQLite)
    try {
      const Database = (await import('better-sqlite3')).default;
      const { join } = await import('node:path');
      const { existsSync, mkdirSync } = await import('node:fs');
      const taskDbDir = this.userDataPath;
      if (!existsSync(taskDbDir)) mkdirSync(taskDbDir, { recursive: true });
      const taskDbPath = join(taskDbDir, 'mimo-tasks.db');
      const taskDb = new Database(taskDbPath);
      taskDb.pragma('journal_mode = WAL');
      this.taskRegistry = new TaskRegistry(taskDb);
      console.log('[Agent] Task registry initialized');
    } catch (err) {
      console.warn('[Agent] Task registry init failed, continuing without task system:', err);
    }

    // Initialize plugin registry
    try {
      const { join } = await import('node:path');
      const pluginDir = join(this.userDataPath, 'plugins');
      this.pluginRegistry = new PluginRegistry(pluginDir);
      await this.pluginRegistry.initialize();
      console.log('[Agent] Plugin registry initialized');
    } catch (err) {
      console.warn('[Agent] Plugin registry init failed, continuing without plugins:', err);
    }

    // Initialize MCP servers
    if (this.config.mcp?.servers) {
      try {
        this.mcpManager = new McpManager();
        for (const [name, serverConfig] of Object.entries(this.config.mcp.servers)) {
          this.mcpManager.addServer({
            name,
            ...serverConfig,
            enabled: serverConfig.enabled ?? true,
          });
        }
        await this.mcpManager.connectAll();

        // Register MCP tools as native tools
        const mcpTools = this.mcpManager.getAllTools();
        for (const tool of mcpTools) {
          this.toolRegistry.register(new McpToolAdapter(tool, this.mcpManager));
        }
        if (mcpTools.length > 0) {
          console.log(`[Agent] Registered ${mcpTools.length} MCP tools`);
        }
      } catch (err) {
        console.warn('[Agent] MCP init failed, continuing without MCP tools:', err);
      }
    }

    // Initialize sandbox if enabled
    if (this.sandboxManager) {
      try {
        await this.sandboxManager.initialize();
        console.log('[Agent] Sandbox initialized:', this.sandboxManager.isEnabled() ? 'active' : 'fallback to local');
      } catch (err) {
        console.warn('[Agent] Sandbox init failed, using local execution:', err);
      }
    }

    this.permissionChecker = new PermissionChecker(this.config.permissionMode, this.config.pathPermissionRules);

    // Register built-in tools
    registerBuiltinTools(this.toolRegistry, this.config.toolPreset || 'act', {
      mimoConfig: this.config,
      subAgents: this.config.subAgents,
      getPermissionChecker: () => this.permissionChecker,
      memorySearchTool: this.memorySearchTool || undefined,
      taskRegistry: this.taskRegistry || undefined,
      sessionId: this.sessionId,
    });
    this.toolRegistry.setContext({
      workingDirectory: this.workspace,
      fileCache: this.fileCache,
      sandboxManager: this.sandboxManager || undefined,
    });

    // Configure tool output truncation
    if (this.config.toolOutput) {
      this.toolRegistry.setOutputConfig(this.config.toolOutput);
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(this.config, this.memory.getContent(), this.workspace);
    this.conversation.push({ role: 'system', content: systemPrompt });

    this.initialized = true;

    // Call plugin onAgentStart hook
    if (this.pluginRegistry) {
      await this.pluginRegistry.callHook('onAgentStart');
    }
  }

  getTools(): ChatCompletionTool[] {
    return this.toolRegistry.getDefinitions().map((def) => ({
      type: 'function' as const,
      function: {
        name: def.function.name,
        description: def.function.description,
        parameters: def.function.parameters as Record<string, unknown>,
      },
    }));
  }

  async *run(prompt: string, options?: Partial<AgentLoopOptions>): AsyncGenerator<LoopEvent> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Add user message
    this.conversation.push({ role: 'user', content: prompt });

    // Check if context compaction is needed
    const maxTokens = this.config.contextWindow || 80000;
    if (shouldCompact(this.conversation, maxTokens)) {
      console.log(`[Agent] Context compaction triggered (${estimateConversationTokens(this.conversation)} tokens > ${maxTokens})`);
      try {
        const result = await compactMessages(this.conversation, this.llmClient, { maxTokens });
        if (result.removedCount > 0) {
          this.conversation = result.messages;
          console.log(`[Agent] Compacted: ${result.removedCount} messages removed, ${result.originalTokens} -> ${result.compactedTokens} tokens`);
        }
      } catch (err) {
        console.error('[Agent] Compaction failed, continuing without:', err);
      }
    }

    this.toolRegistry.setContext({
      workingDirectory: this.workspace,
      fileCache: this.fileCache,
      abortSignal: options?.abortSignal,
    });

    const tools = this.getTools();

    const loopOptions: AgentLoopOptions = {
      maxTurns: this.config.maxTurns,
      streaming: this.config.stream,
      abortSignal: options?.abortSignal,
      contextWindow: this.config.contextWindow,
      maxOutputTokens: this.config.maxTokens,
      taskRegistry: this.taskRegistry || undefined,
      sessionId: this.sessionId,
      ...options,
    };

    // Merge user hooks with plugin hooks
    const pluginRegistry = this.pluginRegistry;
    const mergedHooks: AgentHooks | undefined = pluginRegistry ? {
      beforeTool: async (name: string, args: Record<string, unknown>): Promise<{ skip?: boolean; modifiedArgs?: Record<string, unknown> } | void> => {
        // Call user hook first
        if (this.hooks?.beforeTool) {
          const userResult = await this.hooks.beforeTool(name, args);
          if (userResult?.skip) return userResult;
          if (userResult?.modifiedArgs) args = userResult.modifiedArgs;
        }
        // Call plugin hooks
        const pluginResult = await pluginRegistry.callBeforeToolHooks(name, args);
        return { skip: pluginResult.skip, modifiedArgs: pluginResult.args };
      },
      afterTool: async (name: string, result: import('../tools/base.js').ToolResult): Promise<{ modifiedResult?: import('../tools/base.js').ToolResult } | void> => {
        // Call user hook first
        if (this.hooks?.afterTool) {
          const userResult = await this.hooks.afterTool(name, result);
          if (userResult?.modifiedResult) result = userResult.modifiedResult;
        }
        // Call plugin hooks
        const modifiedResult = await pluginRegistry.callAfterToolHooks(name, result);
        return { modifiedResult };
      },
    } : this.hooks;

    try {
      yield* agentLoop(
        this.conversation,
        tools,
        this.llmClient,
        this.toolRegistry,
        this.permissionChecker,
        {
          ...loopOptions,
          hooks: mergedHooks,
          onUsage: (promptTokens: number, completionTokens: number, cachedTokens?: number) => {
            this.usageTracker.recordUsage(this.config.model, promptTokens, completionTokens, cachedTokens);
          },
          onToolStart: (name: string, args: Record<string, unknown>) => {
            this.usageTracker.incrementToolCall();
            loopOptions.onToolStart?.(name, args);
          },
        },
      );
    } finally {
      // Call plugin onAgentEnd hook when the generator finishes
      if (this.pluginRegistry) {
        await this.pluginRegistry.callHook('onAgentEnd');
      }
    }
  }

  clearConversation(): void {
    const systemMsg = this.conversation[0];
    this.conversation = systemMsg ? [systemMsg] : [];
  }

  getConversationLength(): number {
    return this.conversation.length;
  }

  getConfig(): MimoConfig {
    return { ...this.config };
  }

  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  getPermissionChecker(): PermissionChecker | null {
    return this.permissionChecker;
  }

  getUsageTracker(): UsageTracker {
    return this.usageTracker;
  }

  getConversation(): ChatMessage[] {
    return this.conversation;
  }

  setConversation(messages: ChatMessage[]): void {
    this.conversation = messages;
  }

  getMemory(): ProjectMemory {
    return this.memory;
  }

  getMemoryService(): MemoryService | null {
    return this.memoryService;
  }

  getTaskRegistry(): TaskRegistry | null {
    return this.taskRegistry;
  }

  getPluginRegistry(): PluginRegistry | null {
    return this.pluginRegistry;
  }

  getMcpManager(): McpManager | null {
    return this.mcpManager;
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  setHooks(hooks: AgentHooks): void {
    this.hooks = hooks;
  }
}
