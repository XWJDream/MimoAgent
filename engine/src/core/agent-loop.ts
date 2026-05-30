import type { ChatMessage } from '../llm/types.js';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { LLMClient } from '../llm/client.js';
import { StreamCollector } from '../llm/streaming.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { PermissionChecker } from '../permissions/checker.js';
import type { ToolResult } from '../tools/base.js';

export type LoopEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_start'; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; result: ToolResult }
  | { type: 'done'; usage?: { prompt: number; completion: number; total: number } }
  | { type: 'error'; message: string };

export interface AgentLoopOptions {
  maxTurns: number;
  streaming: boolean;
  abortSignal?: AbortSignal;
  onToken?: (token: string) => void;
  onToolStart?: (name: string, args: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: ToolResult) => void;
  onUsage?: (promptTokens: number, completionTokens: number) => void;
}

export async function* agentLoop(
  messages: ChatMessage[],
  tools: ChatCompletionTool[],
  llmClient: LLMClient,
  toolRegistry: ToolRegistry,
  permissionChecker: PermissionChecker | null,
  options: AgentLoopOptions,
): AsyncGenerator<LoopEvent> {
  let turnCount = 0;

  while (turnCount < options.maxTurns) {
    if (options.abortSignal?.aborted) {
      yield { type: 'error', message: 'Agent run stopped' };
      return;
    }

    turnCount++;

    const collector = new StreamCollector();

    let promptTokens = 0;
    let completionTokens = 0;

    if (options.streaming) {
      const stream = llmClient.chatStream(messages, tools, options.abortSignal);
      for await (const event of stream) {
        if (options.abortSignal?.aborted) {
          yield { type: 'error', message: 'Agent run stopped' };
          return;
        }
        if (event.type === 'content_delta' && event.delta) {
          options.onToken?.(event.delta);
        }
        if (event.type === 'finish' && event.usage) {
          promptTokens = event.usage.promptTokens;
          completionTokens = event.usage.completionTokens;
        }
        collector.feed(event);
      }
    } else {
      const response = await llmClient.chat(messages, tools, options.abortSignal);
      promptTokens = response.usage.promptTokens;
      completionTokens = response.usage.completionTokens;
      if (response.content) {
        collector.feed({ type: 'content_delta', delta: response.content });
      }
      if (response.toolCalls) {
        for (let i = 0; i < response.toolCalls.length; i++) {
          const tc = response.toolCalls[i];
          collector.feed({ type: 'tool_call_start', index: i, id: tc.id, name: tc.name });
          collector.feed({ type: 'tool_call_delta', index: i, argumentsDelta: JSON.stringify(tc.arguments) });
        }
      }
    }

    if (promptTokens > 0 || completionTokens > 0) {
      options.onUsage?.(promptTokens, completionTokens);
    }

    const { content, toolCalls } = collector.getResult();

    if (content) {
      yield { type: 'text', content };
    }

    if (!toolCalls || toolCalls.length === 0) {
      yield { type: 'done' };
      return;
    }

    messages.push({
      role: 'assistant',
      content: content || null,
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      if (options.abortSignal?.aborted) {
        yield { type: 'error', message: 'Agent run stopped' };
        return;
      }

      if (permissionChecker) {
        const tool = toolRegistry.get(toolCall.name);
        const riskLevel = tool?.riskLevel || 'execute';
        const permission = await permissionChecker.check({
          toolName: toolCall.name,
          args: toolCall.arguments,
          riskLevel,
          description: `${toolCall.name}(${JSON.stringify(toolCall.arguments).slice(0, 100)})`,
        });

        if (!permission.allowed) {
          const errorResult: ToolResult = {
            output: `Permission denied: ${permission.reason || 'User denied this operation'}`,
            isError: true,
          };
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(errorResult),
          });
          yield { type: 'tool_result', name: toolCall.name, result: errorResult };
          continue;
        }
      }

      options.onToolStart?.(toolCall.name, toolCall.arguments);
      const result = await toolRegistry.execute(toolCall.name, toolCall.arguments);
      options.onToolResult?.(toolCall.name, result);

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });

      yield { type: 'tool_result', name: toolCall.name, result };
    }
  }

  yield { type: 'error', message: `Max turns (${options.maxTurns}) exceeded` };
}
