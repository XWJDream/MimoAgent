import type { ChatMessage } from '../llm/types.js';
import type { Tokenizer } from '../llm/tokenizer.js';

export interface CompactionResult {
  messages: ChatMessage[];
  originalTokens: number;
  compactedTokens: number;
  removedCount: number;
  summaryMessage: ChatMessage;
}

export interface CompactionOptions {
  maxTokens: number;
  keepSystemPrompt: boolean;
  keepRecentCount: number;
  summaryPrefix: string;
}

const defaultOptions: CompactionOptions = {
  maxTokens: 100000,
  keepSystemPrompt: true,
  keepRecentCount: 6,
  summaryPrefix: '[Conversation history compacted]',
};

export function shouldCompact(messages: ChatMessage[], tokenizer: Tokenizer, maxTokens: number): boolean {
  const totalTokens = messages.reduce((sum, msg) => sum + countMessageTokens(msg, tokenizer), 0);
  return totalTokens > maxTokens;
}

export function compactMessages(
  messages: ChatMessage[],
  tokenizer: Tokenizer,
  options: Partial<CompactionOptions> = {},
): CompactionResult {
  const opts = { ...defaultOptions, ...options };
  const originalTokens = messages.reduce((sum, msg) => sum + countMessageTokens(msg, tokenizer), 0);

  if (messages.length <= opts.keepRecentCount + 1) {
    return {
      messages,
      originalTokens,
      compactedTokens: originalTokens,
      removedCount: 0,
      summaryMessage: { role: 'user', content: '' },
    };
  }

  const systemMessages: ChatMessage[] = [];
  const otherMessages: ChatMessage[] = [];

  for (const msg of messages) {
    if (opts.keepSystemPrompt && msg.role === 'system') {
      systemMessages.push(msg);
    } else {
      otherMessages.push(msg);
    }
  }

  // Keep the most recent messages
  const recentCount = Math.min(opts.keepRecentCount, otherMessages.length);
  const recentMessages = otherMessages.slice(-recentCount);
  const oldMessages = otherMessages.slice(0, -recentCount);

  // Build summary of old messages
  const summaryParts: string[] = [];
  let userTurns = 0;
  let assistantTurns = 0;
  let toolCalls = 0;
  const topics: string[] = [];

  for (const msg of oldMessages) {
    if (msg.role === 'user') {
      userTurns++;
      if (msg.content && msg.content.length < 200) {
        topics.push(msg.content.slice(0, 80));
      }
    } else if (msg.role === 'assistant') {
      assistantTurns++;
      if (msg.tool_calls) {
        toolCalls += msg.tool_calls.length;
      }
    }
  }

  summaryParts.push(`${opts.summaryPrefix} ${userTurns} user messages and ${assistantTurns} assistant responses were summarized to save context space.`);

  if (toolCalls > 0) {
    summaryParts.push(`${toolCalls} tool calls were executed during this section.`);
  }

  if (topics.length > 0) {
    summaryParts.push(`Topics discussed: ${topics.slice(0, 5).join('; ')}`);
  }

  // Extract key information from tool results
  const keyFindings: string[] = [];
  for (const msg of oldMessages) {
    if (msg.role === 'tool' && msg.content) {
      try {
        const result = JSON.parse(msg.content);
        if (result.isError && result.output) {
          keyFindings.push(`Error: ${result.output.slice(0, 100)}`);
        }
      } catch {
        // Not JSON, skip
      }
    }
  }

  if (keyFindings.length > 0) {
    summaryParts.push(`Key findings: ${keyFindings.slice(0, 3).join('; ')}`);
  }

  const summaryContent = summaryParts.join('\n');
  const summaryMessage: ChatMessage = {
    role: 'user',
    content: `[Context Summary]\n${summaryContent}`,
  };

  // Rebuild message list
  const compactedMessages: ChatMessage[] = [
    ...systemMessages,
    summaryMessage,
    { role: 'assistant', content: 'I understand. I have the context summary and will continue from here. What would you like me to do?' },
    ...recentMessages,
  ];

  const compactedTokens = compactedMessages.reduce((sum, msg) => sum + countMessageTokens(msg, tokenizer), 0);

  return {
    messages: compactedMessages,
    originalTokens,
    compactedTokens,
    removedCount: oldMessages.length,
    summaryMessage,
  };
}

function countMessageTokens(message: ChatMessage, tokenizer: Tokenizer): number {
  let count = 0;
  if (message.content) {
    count += tokenizer.countTokens(message.content);
  }
  if (message.tool_calls) {
    for (const tc of message.tool_calls) {
      count += tokenizer.countTokens(tc.name);
      count += tokenizer.countTokens(JSON.stringify(tc.arguments));
    }
  }
  return count + 4; // Message overhead
}

export function estimateConversationTokens(messages: ChatMessage[], tokenizer: Tokenizer): number {
  return messages.reduce((sum, msg) => sum + countMessageTokens(msg, tokenizer), 0);
}
