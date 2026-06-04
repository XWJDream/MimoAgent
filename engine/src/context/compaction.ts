import type { ChatMessage } from '../llm/types.js';
import type { LLMClient } from '../llm/client.js';
import { estimateMessageTokens } from '../llm/tokenizer.js';

export interface CompactionResult {
  messages: ChatMessage[];
  originalTokens: number;
  compactedTokens: number;
  removedCount: number;
  summaryContent: string;
}

export interface CompactionOptions {
  maxTokens: number;
  keepSystemPrompt: boolean;
  keepRecentCount: number;
}

const DEFAULT_OPTIONS: CompactionOptions = {
  maxTokens: 80000,
  keepSystemPrompt: true,
  keepRecentCount: 6,
};

export const SUMMARIZER_PROMPT = `You are a conversation summarization specialist. Your ONLY job is to produce a structured summary of a conversation history.

The summary MUST preserve:
1. **What was accomplished** — files created/modified with exact paths, features implemented, bugs fixed
2. **Current state** — what is being worked on right now, any in-progress changes
3. **Key decisions** — technical choices made, architecture decisions, user preferences expressed
4. **Important findings** — errors encountered, code patterns discovered, file locations with line numbers
5. **Next steps** — what needs to be done next, pending tasks

Format as structured markdown. Be concise but include specific file paths, function names, and technical details that would be needed to continue the work. Do NOT include conversational filler — only factual technical content.`;

export function estimateConversationTokens(messages: ChatMessage[]): number {
  return messages.reduce((sum, msg) => {
    return sum + estimateMessageTokens(
      msg.content,
      msg.role,
      msg.tool_calls?.map(tc => ({ name: tc.name, arguments: tc.arguments })),
      msg.tool_call_id,
    );
  }, 0);
}

export function shouldCompact(messages: ChatMessage[], maxTokens: number): boolean {
  return estimateConversationTokens(messages) > maxTokens;
}

/**
 * Compact conversation by using the LLM to summarize old messages.
 * Keeps system prompt + recent N messages, summarizes the rest.
 * If llmClient is not provided, falls back to rule-based summary.
 */
export async function compactMessages(
  messages: ChatMessage[],
  llmClient?: LLMClient | null,
  options: Partial<CompactionOptions> = {},
): Promise<CompactionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalTokens = estimateConversationTokens(messages);

  // Not enough messages to compact
  if (messages.length <= opts.keepRecentCount + 1) {
    return {
      messages,
      originalTokens,
      compactedTokens: originalTokens,
      removedCount: 0,
      summaryContent: '',
    };
  }

  // Split: system messages vs conversation
  const systemMessages: ChatMessage[] = [];
  const otherMessages: ChatMessage[] = [];

  for (const msg of messages) {
    if (opts.keepSystemPrompt && msg.role === 'system') {
      systemMessages.push(msg);
    } else {
      otherMessages.push(msg);
    }
  }

  // Keep recent messages, summarize the rest
  const recentMessages = otherMessages.slice(-opts.keepRecentCount);
  const oldMessages = otherMessages.slice(0, -opts.keepRecentCount);

  if (oldMessages.length === 0) {
    return {
      messages,
      originalTokens,
      compactedTokens: originalTokens,
      removedCount: 0,
      summaryContent: '',
    };
  }

  // Build conversation text for summarization
  const conversationText = oldMessages
    .map((msg) => {
      const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'Tool';
      let text = `[${role}]`;
      if (msg.content) {
        text += ` ${msg.content.slice(0, 500)}`;
      }
      if (msg.tool_calls) {
        text += ` [Called: ${msg.tool_calls.map((tc) => tc.name).join(', ')}]`;
      }
      return text;
    })
    .join('\n');

  // Use LLM to generate summary (or fallback if no client)
  let summaryContent = '';
  if (llmClient) {
    try {
      const summaryMessages: ChatMessage[] = [
        { role: 'system', content: SUMMARIZER_PROMPT },
        { role: 'user', content: `Please summarize this conversation:\n\n${conversationText}` },
      ];
      const response = await llmClient.chat(summaryMessages);
      summaryContent = response.content || 'Previous conversation context was compacted.';
    } catch {
      llmClient = null; // Fall through to simple summary
    }
  }
  if (!summaryContent) {
    // Fallback to simple summary if LLM fails or not available
    const userTurns = oldMessages.filter((m) => m.role === 'user').length;
    const assistantTurns = oldMessages.filter((m) => m.role === 'assistant').length;
    const toolCalls = oldMessages.reduce((sum, m) => sum + (m.tool_calls?.length || 0), 0);
    const topics = oldMessages
      .filter((m) => m.role === 'user' && m.content && m.content.length < 200)
      .map((m) => m.content!.slice(0, 80))
      .slice(0, 5);
    summaryContent = `Conversation history compacted: ${userTurns} user messages, ${assistantTurns} assistant responses, ${toolCalls} tool calls.\nTopics: ${topics.join('; ')}`;
  }

  const summaryMessage: ChatMessage = {
    role: 'user',
    content: `[Context Summary]\n${summaryContent}`,
  };

  const compactedMessages: ChatMessage[] = [
    ...systemMessages,
    summaryMessage,
    { role: 'assistant', content: 'I understand the context summary. I will continue from here.' },
    ...recentMessages,
  ];

  const compactedTokens = estimateConversationTokens(compactedMessages);

  return {
    messages: compactedMessages,
    originalTokens,
    compactedTokens,
    removedCount: oldMessages.length,
    summaryContent,
  };
}
