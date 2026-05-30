import type { ChatMessage } from '../llm/types.js';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { LLMClient } from '../llm/client.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { PermissionChecker } from '../permissions/checker.js';
import type { ToolResult } from '../tools/base.js';
export type LoopEvent = {
    type: 'text';
    content: string;
} | {
    type: 'tool_start';
    name: string;
    args: Record<string, unknown>;
} | {
    type: 'tool_result';
    name: string;
    result: ToolResult;
} | {
    type: 'done';
    usage?: {
        prompt: number;
        completion: number;
        total: number;
    };
} | {
    type: 'error';
    message: string;
};
export interface AgentLoopOptions {
    maxTurns: number;
    streaming: boolean;
    onToken?: (token: string) => void;
    onToolStart?: (name: string, args: Record<string, unknown>) => void;
    onToolResult?: (name: string, result: ToolResult) => void;
    onUsage?: (promptTokens: number, completionTokens: number) => void;
}
export declare function agentLoop(messages: ChatMessage[], tools: ChatCompletionTool[], llmClient: LLMClient, toolRegistry: ToolRegistry, permissionChecker: PermissionChecker | null, options: AgentLoopOptions): AsyncGenerator<LoopEvent>;
