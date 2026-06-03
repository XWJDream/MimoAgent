import type { MimoConfig } from '../config/types.js';
import type { ChatMessage } from '../llm/types.js';
import { LLMClient } from '../llm/client.js';
import { ToolRegistry } from '../tools/registry.js';
import { registerBuiltinTools } from '../tools/builtin/index.js';
import { PermissionChecker } from '../permissions/checker.js';
import { agentLoop, type LoopEvent, type AgentLoopOptions, type AgentHooks } from './agent-loop.js';
import { buildSystemPrompt } from '../context/system-prompt.js';
import { ProjectMemory } from '../context/memory.js';
import { FileCache } from '../context/file-cache.js';
import { UsageTracker } from '../context/usage-tracker.js';
import { shouldCompact, compactMessages, estimateConversationTokens } from '../context/compaction.js';
import { SandboxManager } from '../sandbox/manager.js';
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

  constructor(config: MimoConfig, workspace?: string) {
    this.config = config;
    this.workspace = workspace || process.cwd();
    this.llmClient = new LLMClient({
      apiKey: config.apiKey,
      baseUrl: config.apiBase,
      model: config.model,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
      timeout: 60000,
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
    });
    this.toolRegistry.setContext({
      workingDirectory: this.workspace,
      fileCache: this.fileCache,
      sandboxManager: this.sandboxManager || undefined,
    });

    // Build system prompt
    const systemPrompt = buildSystemPrompt(this.config, this.memory.getContent(), this.workspace);
    this.conversation.push({ role: 'system', content: systemPrompt });

    this.initialized = true;
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
      ...options,
    };

    yield* agentLoop(
      this.conversation,
      tools,
      this.llmClient,
      this.toolRegistry,
      this.permissionChecker,
      {
        ...loopOptions,
        hooks: this.hooks,
        onUsage: (promptTokens: number, completionTokens: number, cachedTokens?: number) => {
          this.usageTracker.recordUsage(this.config.model, promptTokens, completionTokens, cachedTokens);
        },
        onToolStart: (name: string, args: Record<string, unknown>) => {
          this.usageTracker.incrementToolCall();
          loopOptions.onToolStart?.(name, args);
        },
      },
    );
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

  setHooks(hooks: AgentHooks): void {
    this.hooks = hooks;
  }
}
