import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import type { ChatMessage, ChatResponse, ToolCall, TokenUsage, StreamEvent } from './types.js';
import { withRetry } from './retry.js';

export interface LLMClientConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
}

export class LLMClient {
  private client: OpenAI;
  private config: LLMClientConfig;

  constructor(config: LLMClientConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout,
    });
  }

  async chat(messages: ChatMessage[], tools?: ChatCompletionTool[], signal?: AbortSignal): Promise<ChatResponse> {
    const params: OpenAI.ChatCompletionCreateParams = {
      model: this.config.model,
      messages: this.toOpenAIMessages(messages),
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
    };

    if (tools && tools.length > 0) {
      params.tools = tools;
      params.tool_choice = 'auto';
    }

    const response = await withRetry(() => this.client.chat.completions.create(params, { signal }));
    const choice = response.choices[0];

    return {
      content: choice.message.content,
      toolCalls: this.parseToolCalls(choice.message.tool_calls),
      usage: this.parseUsage(response.usage),
      finishReason: choice.finish_reason as ChatResponse['finishReason'],
    };
  }

  async *chatStream(
    messages: ChatMessage[],
    tools?: ChatCompletionTool[],
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent> {
    const params: OpenAI.ChatCompletionCreateParams = {
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

    const stream = await withRetry(() => this.client.chat.completions.create(params, { signal }));

    for await (const chunk of stream) {
      if (signal?.aborted) {
        throw new DOMException('Agent run was stopped', 'AbortError');
      }
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

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

  private toOpenAIMessages(messages: ChatMessage[]): ChatCompletionMessageParam[] {
    return messages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          tool_call_id: msg.tool_call_id!,
          content: msg.content || '',
        };
      }
      if (msg.role === 'assistant' && msg.tool_calls) {
        return {
          role: 'assistant' as const,
          content: msg.content,
          tool_calls: msg.tool_calls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }
      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content || '',
      };
    });
  }

  private parseToolCalls(toolCalls: OpenAI.ChatCompletionMessageToolCall[] | undefined): ToolCall[] | null {
    if (!toolCalls || toolCalls.length === 0) return null;
    return toolCalls.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));
  }

  private parseUsage(usage: OpenAI.CompletionUsage | undefined): TokenUsage {
    if (!usage) return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    return {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    };
  }
}
