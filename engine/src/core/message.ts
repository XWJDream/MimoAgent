import type { ChatMessage, ToolCall } from '../llm/types.js';
import { estimateTokens } from '../llm/tokenizer.js';

export interface ConversationEntry {
  role: ChatMessage['role'];
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  timestamp: number;
  tokenCount: number;
}

export function createMessage(
  role: ChatMessage['role'],
  content: string,
  options: { tool_calls?: ToolCall[]; tool_call_id?: string } = {},
): ConversationEntry {
  return {
    role,
    content,
    tool_calls: options.tool_calls,
    tool_call_id: options.tool_call_id,
    timestamp: Date.now(),
    tokenCount: estimateTokens(content),
  };
}

export function toChatMessage(entry: ConversationEntry): ChatMessage {
  return {
    role: entry.role,
    content: entry.content,
    tool_calls: entry.tool_calls,
    tool_call_id: entry.tool_call_id,
  };
}
