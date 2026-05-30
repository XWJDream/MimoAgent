import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import type { ChatMessage, ChatResponse, StreamEvent } from './types.js';
export interface LLMClientConfig {
    apiKey: string;
    baseUrl: string;
    model: string;
    maxTokens: number;
    temperature: number;
    timeout: number;
}
export declare class LLMClient {
    private client;
    private config;
    constructor(config: LLMClientConfig);
    chat(messages: ChatMessage[], tools?: ChatCompletionTool[]): Promise<ChatResponse>;
    chatStream(messages: ChatMessage[], tools?: ChatCompletionTool[]): AsyncGenerator<StreamEvent>;
    private toOpenAIMessages;
    private parseToolCalls;
    private parseUsage;
}
