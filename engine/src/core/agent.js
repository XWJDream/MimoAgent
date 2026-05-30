"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Agent = void 0;
const client_js_1 = require("../llm/client.js");
const registry_js_1 = require("../tools/registry.js");
const index_js_1 = require("../tools/builtin/index.js");
const agent_loop_js_1 = require("./agent-loop.js");
const system_prompt_js_1 = require("../context/system-prompt.js");
const memory_js_1 = require("../context/memory.js");
const usage_tracker_js_1 = require("../context/usage-tracker.js");
class Agent {
    config;
    llmClient;
    toolRegistry;
    permissionChecker = null;
    conversation = [];
    memory;
    usageTracker;
    initialized = false;
    constructor(config) {
        this.config = config;
        this.llmClient = new client_js_1.LLMClient({
            apiKey: config.apiKey,
            baseUrl: config.apiBase,
            model: config.model,
            maxTokens: config.maxTokens,
            temperature: config.temperature,
            timeout: 60000,
        });
        this.toolRegistry = new registry_js_1.ToolRegistry();
        this.memory = new memory_js_1.ProjectMemory(process.cwd());
        this.usageTracker = new usage_tracker_js_1.UsageTracker();
    }
    async initialize() {
        if (this.initialized)
            return;
        // Load project memory and usage history
        await Promise.all([this.memory.load(), this.usageTracker.load()]);
        // Register built-in tools
        (0, index_js_1.registerBuiltinTools)(this.toolRegistry);
        // Build system prompt
        const systemPrompt = (0, system_prompt_js_1.buildSystemPrompt)(this.config, this.memory.getContent(), process.cwd());
        this.conversation.push({ role: 'system', content: systemPrompt });
        this.initialized = true;
    }
    getTools() {
        return this.toolRegistry.getDefinitions().map((def) => ({
            type: 'function',
            function: {
                name: def.function.name,
                description: def.function.description,
                parameters: def.function.parameters,
            },
        }));
    }
    async *run(prompt, options) {
        if (!this.initialized) {
            await this.initialize();
        }
        // Add user message
        this.conversation.push({ role: 'user', content: prompt });
        const tools = this.getTools();
        const loopOptions = {
            maxTurns: this.config.maxTurns,
            streaming: this.config.stream,
            ...options,
        };
        yield* (0, agent_loop_js_1.agentLoop)(this.conversation, tools, this.llmClient, this.toolRegistry, this.permissionChecker, {
            ...loopOptions,
            onUsage: (promptTokens, completionTokens) => {
                this.usageTracker.recordUsage(this.config.model, promptTokens, completionTokens);
            },
            onToolStart: (name, args) => {
                this.usageTracker.incrementToolCall();
                loopOptions.onToolStart?.(name, args);
            },
        });
    }
    clearConversation() {
        const systemMsg = this.conversation[0];
        this.conversation = systemMsg ? [systemMsg] : [];
    }
    getConversationLength() {
        return this.conversation.length;
    }
    getConfig() {
        return { ...this.config };
    }
    getToolRegistry() {
        return this.toolRegistry;
    }
    getUsageTracker() {
        return this.usageTracker;
    }
    getConversation() {
        return this.conversation;
    }
    setConversation(messages) {
        this.conversation = messages;
    }
    getMemory() {
        return this.memory;
    }
}
exports.Agent = Agent;
//# sourceMappingURL=agent.js.map