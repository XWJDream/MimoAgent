import type { ChatMessage } from '../llm/types.js';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { LLMClient } from '../llm/client.js';
import { StreamCollector } from '../llm/streaming.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { PermissionChecker } from '../permissions/checker.js';
import type { ToolResult } from '../tools/base.js';
import { createValidator, type ValidationOptions, type ValidationResult } from './validator.js';
import { estimateMessageTokens, estimateTokens } from '../llm/tokenizer.js';
import { pressureLevel as calcPressure, type OverflowInput } from '../context/overflow.js';
import { microcompact } from '../context/compaction.js';
import type { TaskRegistry } from '../task/registry.js';
import { decideGate, type GateDecision } from '../task/gate.js';

export interface AgentHooks {
  beforeTool?: (name: string, args: Record<string, unknown>) => Promise<{ skip?: boolean; modifiedArgs?: Record<string, unknown> } | void>;
  afterTool?: (name: string, result: ToolResult) => Promise<{ modifiedResult?: ToolResult } | void>;
}

export type LoopEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_start'; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; name: string; result: ToolResult }
  | { type: 'validation'; tool: string; result: ValidationResult }
  | { type: 'reflection'; prompt: string }
  | { type: 'done'; usage?: { prompt: number; completion: number; total: number } }
  | { type: 'error'; message: string }
  | { type: 'context_pressure'; level: 0 | 1 | 2 | 3; usable: number; current: number }
  | { type: 'gate'; decision: GateDecision };

export interface AgentLoopOptions {
  maxTurns: number;
  streaming: boolean;
  abortSignal?: AbortSignal;
  onToken?: (token: string) => void;
  onToolStart?: (name: string, args: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: ToolResult) => void;
  onUsage?: (promptTokens: number, completionTokens: number, cachedTokens?: number) => void;
  hooks?: AgentHooks;
  validation?: ValidationOptions;
  /** Model context window size for pressure detection */
  contextWindow?: number;
  /** Model max output tokens for pressure detection */
  maxOutputTokens?: number;
  /** Task registry for gate mechanism */
  taskRegistry?: TaskRegistry;
  /** Session ID for gate mechanism */
  sessionId?: string;
}

export async function* agentLoop(
  messages: ChatMessage[],
  tools: ChatCompletionTool[],
  llmClient: Pick<LLMClient, 'chat' | 'chatStream'>,
  toolRegistry: ToolRegistry,
  permissionChecker: PermissionChecker | null,
  options: AgentLoopOptions,
): AsyncGenerator<LoopEvent> {
  const MAX_TURNS = Math.min(options.maxTurns, 100); // Safety cap at 100
  let turnCount = 0;
  const recentToolCalls: string[] = []; // For loop detection
  const validator = createValidator(options.validation);
  const toolResults: Array<{ tool: string; result: ToolResult }> = [];
  let gateReactCount = 0; // Gate re-entry counter

  while (turnCount < MAX_TURNS) {
    if (options.abortSignal?.aborted) {
      yield { type: 'error', message: 'Agent run stopped' };
      return;
    }

    turnCount++;

    const collector = new StreamCollector();

    let promptTokens = 0;
    let completionTokens = 0;
    let cachedTokens = 0;

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
          cachedTokens = event.usage.cachedTokens ?? 0;
        }
        collector.feed(event);
      }
    } else {
      const response = await llmClient.chat(messages, tools, options.abortSignal);
      promptTokens = response.usage.promptTokens;
      completionTokens = response.usage.completionTokens;
      cachedTokens = response.usage.cachedTokens ?? 0;
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

    // If API didn't return usage data, estimate based on content
    if (promptTokens === 0 && completionTokens === 0) {
      const { content: responseContent, toolCalls: responseToolCalls } = collector.getResult();

      // Estimate prompt tokens from messages using improved algorithm
      promptTokens = messages.reduce((sum, m) => {
        return sum + estimateMessageTokens(
          m.content,
          m.role,
          m.tool_calls?.map(tc => ({ name: tc.name, arguments: tc.arguments })),
          m.tool_call_id,
        );
      }, 0);

      // Estimate completion tokens from response
      let completionTokensEst = 0;
      if (responseContent) {
        completionTokensEst += estimateTokens(responseContent);
      }
      if (responseToolCalls) {
        for (const tc of responseToolCalls) {
          completionTokensEst += estimateTokens(tc.name);
          completionTokensEst += estimateTokens(JSON.stringify(tc.arguments));
          completionTokensEst += 6; // tool_call framing
        }
      }
      completionTokens = completionTokensEst + 4; // response message framing
    }

    if (promptTokens > 0 || completionTokens > 0) {
      options.onUsage?.(promptTokens, completionTokens, cachedTokens);
    }

    // --- Context pressure detection ---
    if (options.contextWindow && options.contextWindow > 0 && promptTokens > 0) {
      const overflowInput: OverflowInput = {
        contextWindow: options.contextWindow,
        maxOutputTokens: options.maxOutputTokens ?? 4096,
        currentTokens: promptTokens,
      }
      const level = calcPressure(overflowInput)
      const usableTokens = overflowInput.contextWindow > 0
        ? Math.max(0, overflowInput.contextWindow - Math.min(overflowInput.maxOutputTokens, 20_000) - 20_000)
        : 0
      yield { type: 'context_pressure', level, usable: usableTokens, current: promptTokens }

      // Trigger progressive compaction based on pressure level
      if (level >= 3) {
        // Severe: microcompact everything except last 2 messages
        const compacted = microcompact(messages, 2)
        messages.length = 0
        messages.push(...compacted)
      } else if (level >= 2) {
        // Moderate: microcompact older half
        const preserveCount = Math.max(4, Math.ceil(messages.length / 2))
        const compacted = microcompact(messages, preserveCount)
        messages.length = 0
        messages.push(...compacted)
      } else if (level >= 1) {
        // Light: microcompact only the oldest messages, keep last 4 intact
        const compacted = microcompact(messages, 4)
        messages.length = 0
        messages.push(...compacted)
      }
    }

    const { content, toolCalls } = collector.getResult();

    if (content) {
      yield { type: 'text', content };
    }

    if (!toolCalls || toolCalls.length === 0) {
      // Gate mechanism: check if there are incomplete tasks
      if (options.taskRegistry && options.sessionId) {
        const gateDecision = decideGate(options.taskRegistry, options.sessionId, gateReactCount);
        yield { type: 'gate', decision: gateDecision };

        if (gateDecision.action === 'continue') {
          gateReactCount++;
          // Inject a system message to guide the agent to continue
          const incompleteSummary = gateDecision.incompleteTasks
            ?.map(t => `  - ${t.id}: ${t.summary} (${t.status})`)
            .join('\n') || '';
          messages.push({
            role: 'system',
            content: `任务门检查: ${gateDecision.reason}\n\n未完成任务:\n${incompleteSummary}\n\n请继续处理未完成的任务。`,
          });
          continue; // Continue the loop
        }
      }

      yield { type: 'done' };
      return;
    }

    // Loop detection: check if the model is repeating the same tool calls
    const toolCallSig = toolCalls.map((tc) => `${tc.name}:${JSON.stringify(tc.arguments)}`).join('|');
    recentToolCalls.push(toolCallSig);
    if (recentToolCalls.length > 6) recentToolCalls.shift();
    const repeatCount = recentToolCalls.filter((s) => s === toolCallSig).length;
    if (repeatCount >= 3) {
      yield { type: 'error', message: 'Agent loop detected: repeated identical tool calls. Stopping.' };
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

      // Validate tool arguments before execution
      const argsValidation = validator.validateToolArgs(toolCall.name, toolCall.arguments);
      if (!argsValidation.valid) {
        const errorResult: ToolResult = {
          output: `Validation failed: ${argsValidation.errors.join(', ')}`,
          isError: true,
        };
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(errorResult),
        });
        yield { type: 'validation', tool: toolCall.name, result: argsValidation };
        yield { type: 'tool_result', name: toolCall.name, result: errorResult };
        continue;
      }

      // Emit warnings if any
      if (argsValidation.warnings.length > 0) {
        yield { type: 'validation', tool: toolCall.name, result: argsValidation };
      }

      options.onToolStart?.(toolCall.name, toolCall.arguments);
      yield { type: 'tool_start', name: toolCall.name, args: toolCall.arguments };

      // beforeTool hook: may skip execution or modify arguments
      let effectiveArgs = toolCall.arguments;
      if (options.hooks?.beforeTool) {
        const hookResult = await options.hooks.beforeTool(toolCall.name, toolCall.arguments);
        if (hookResult?.skip) {
          const skippedResult: ToolResult = { output: `Tool "${toolCall.name}" skipped by hook`, isError: false };
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(skippedResult),
          });
          yield { type: 'tool_result', name: toolCall.name, result: skippedResult };
          continue;
        }
        if (hookResult?.modifiedArgs) {
          effectiveArgs = hookResult.modifiedArgs;
        }
      }

      let result = await toolRegistry.execute(toolCall.name, effectiveArgs);

      // afterTool hook: may modify the result
      if (options.hooks?.afterTool) {
        const hookResult = await options.hooks.afterTool(toolCall.name, result);
        if (hookResult?.modifiedResult) {
          result = hookResult.modifiedResult;
        }
      }

      // Validate tool result
      const resultValidation = validator.validateToolResult(toolCall.name, result);
      if (!resultValidation.valid) {
        yield { type: 'validation', tool: toolCall.name, result: resultValidation };
      } else if (resultValidation.warnings.length > 0) {
        yield { type: 'validation', tool: toolCall.name, result: resultValidation };
      }

      // Track results for reflection
      toolResults.push({ tool: toolCall.name, result });

      options.onToolResult?.(toolCall.name, result);

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });

      yield { type: 'tool_result', name: toolCall.name, result };
    }

    // After processing all tool calls, check if reflection is needed
    // If there were errors, append reflection prompt and continue the loop
    if (toolResults.length > 0) {
      const reflectionPrompt = validator.generateReflectionPrompt('', toolResults);
      if (reflectionPrompt) {
        yield { type: 'reflection', prompt: reflectionPrompt };
        // Append reflection as a system message to guide the next turn
        messages.push({
          role: 'system',
          content: reflectionPrompt,
        });
      }
      // Always clear tool results after processing to prevent memory leak
      toolResults.length = 0;
      if (reflectionPrompt) {
        // Continue to next iteration - don't exit
        continue;
      }
    }
  }

  // Generate final reflection if there were errors or warnings at max turns
  if (toolResults.length > 0) {
    const reflectionPrompt = validator.generateReflectionPrompt('', toolResults);
    if (reflectionPrompt) {
      yield { type: 'reflection', prompt: reflectionPrompt };
      // Note: We don't append to messages here because we're at max turns
      // The reflection is emitted for the user to see
    }
  }

  yield { type: 'error', message: `Max turns (${options.maxTurns}) exceeded` };
}
