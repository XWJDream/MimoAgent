import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import type { ChatMessage, ChatResponse, StreamEvent } from './types.js';
export interface LLMClientConfig {
    apiKey: string;
    baseUrl: string;
    model: string;
    maxTokens: number;
    temperature: number;
    timeout: number;
    reasoningEffort?: 'low' | 'medium' | 'high';
}
export declare class LLMClient {
    private client;
    private config;
    constructor(config: LLMClientConfig);
    chat(messages: ChatMessage[], tools?: ChatCompletionTool[], signal?: AbortSignal): Promise<ChatResponse>;
    chatStream(messages: ChatMessage[], tools?: ChatCompletionTool[], signal?: AbortSignal): AsyncGenerator<StreamEvent>;
    private toOpenAIMessages;
    private parseToolCalls;
    private parseUsage;
}
