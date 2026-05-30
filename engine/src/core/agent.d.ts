import type { MimoConfig } from '../config/types.js';
import type { ChatMessage } from '../llm/types.js';
import { ToolRegistry } from '../tools/registry.js';
import { type LoopEvent, type AgentLoopOptions } from './agent-loop.js';
import { ProjectMemory } from '../context/memory.js';
import { UsageTracker } from '../context/usage-tracker.js';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';
export declare class Agent {
    private config;
    private llmClient;
    private toolRegistry;
    private permissionChecker;
    private conversation;
    private memory;
    private usageTracker;
    private initialized;
    constructor(config: MimoConfig);
    initialize(): Promise<void>;
    getTools(): ChatCompletionTool[];
    run(prompt: string, options?: Partial<AgentLoopOptions>): AsyncGenerator<LoopEvent>;
    clearConversation(): void;
    getConversationLength(): number;
    getConfig(): MimoConfig;
    getToolRegistry(): ToolRegistry;
    getUsageTracker(): UsageTracker;
    getConversation(): ChatMessage[];
    setConversation(messages: ChatMessage[]): void;
    getMemory(): ProjectMemory;
}
