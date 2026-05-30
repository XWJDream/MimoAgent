"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMClient = void 0;
const openai_1 = __importDefault(require("openai"));
class LLMClient {
    client;
    config;
    constructor(config) {
        this.config = config;
        this.client = new openai_1.default({
            apiKey: config.apiKey,
            baseURL: config.baseUrl,
            timeout: config.timeout,
        });
    }
    async chat(messages, tools) {
        const params = {
            model: this.config.model,
            messages: this.toOpenAIMessages(messages),
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
        };
        if (tools && tools.length > 0) {
            params.tools = tools;
            params.tool_choice = 'auto';
        }
        const response = await this.client.chat.completions.create(params);
        const choice = response.choices[0];
        return {
            content: choice.message.content,
            toolCalls: this.parseToolCalls(choice.message.tool_calls),
            usage: this.parseUsage(response.usage),
            finishReason: choice.finish_reason,
        };
    }
    async *chatStream(messages, tools) {
        const params = {
            model: this.config.model,
            messages: this.toOpenAIMessages(messages),
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            stream: true,
        };
        if (tools && tools.length > 0) {
            params.tools = tools;
            params.tool_choice = 'auto';
        }
        const stream = await this.client.chat.completions.create(params);
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (!delta)
                continue;
            if (delta.content) {
                yield { type: 'content_delta', delta: delta.content };
            }
            if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                    if (tc.id) {
                        yield {
                            type: 'tool_call_start',
                            index: tc.index,
                            id: tc.id,
                            name: tc.function?.name,
                        };
                    }
                    if (tc.function?.arguments) {
                        yield {
                            type: 'tool_call_delta',
                            index: tc.index,
                            argumentsDelta: tc.function.arguments,
                        };
                    }
                }
            }
            if (chunk.choices[0]?.finish_reason) {
                yield {
                    type: 'finish',
                    reason: chunk.choices[0].finish_reason,
                    usage: chunk.usage ? this.parseUsage(chunk.usage) : undefined,
                };
            }
        }
    }
    toOpenAIMessages(messages) {
        return messages.map((msg) => {
            if (msg.role === 'tool') {
                return {
                    role: 'tool',
                    tool_call_id: msg.tool_call_id,
                    content: msg.content || '',
                };
            }
            if (msg.role === 'assistant' && msg.tool_calls) {
                return {
                    role: 'assistant',
                    content: msg.content,
                    tool_calls: msg.tool_calls.map((tc) => ({
                        id: tc.id,
                        type: 'function',
                        function: {
                            name: tc.name,
                            arguments: JSON.stringify(tc.arguments),
                        },
                    })),
                };
            }
            return {
                role: msg.role,
                content: msg.content || '',
            };
        });
    }
    parseToolCalls(toolCalls) {
        if (!toolCalls || toolCalls.length === 0)
            return null;
        return toolCalls.map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
        }));
    }
    parseUsage(usage) {
        if (!usage)
            return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
        return {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
        };
    }
}
exports.LLMClient = LLMClient;
//# sourceMappingURL=client.js.map