import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatStore } from './chatStore';
import type { UsageStats } from '@shared/types';

const emptyUsage: UsageStats = {
  sessionTokens: 0,
  sessionCost: 0,
  sessionToolCalls: 0,
  sessionCachedTokens: 0,
  sessionPromptTokens: 0,
  sessionCompletionTokens: 0,
  totalTokens: 0,
  totalCost: 0,
  totalToolCalls: 0,
  currentPromptTokens: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  useChatStore.setState({
    messages: [],
    isThinking: false,
    isStreaming: false,
    currentResponse: '',
    toolCalls: [],
    activeSessionId: 'default',
    usage: { ...emptyUsage },
  });
});

describe('chatStore', () => {
  it('finishResponse stores usage and accumulates cached tokens', () => {
    useChatStore.getState().setStreaming(true);
    useChatStore.setState({ currentResponse: 'hello from agent' });

    useChatStore.getState().finishResponse({ tokens: 100, cost: 0.02, cachedTokens: 40 });

    const state = useChatStore.getState();
    expect(state.isStreaming).toBe(false);
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({
      role: 'assistant',
      content: 'hello from agent',
      usage: { tokens: 100, cost: 0.02, cachedTokens: 40 },
    });
    expect(state.usage.sessionTokens).toBe(100);
    expect(state.usage.sessionCachedTokens).toBe(40);
    expect(state.usage.totalTokens).toBe(100);
  });

  it('clearMessages resets messages, tools, and session usage', () => {
    useChatStore.setState({
      messages: [{ id: 'm1', role: 'user', content: 'hi', timestamp: 1 }],
      toolCalls: [{ id: 't1', name: 'read_file', args: {}, status: 'running' }],
      isThinking: true,
      isStreaming: true,
      usage: { ...emptyUsage, sessionTokens: 5, sessionToolCalls: 1, totalTokens: 5, totalToolCalls: 1 },
    });

    useChatStore.getState().clearMessages();

    const state = useChatStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.toolCalls).toEqual([]);
    expect(state.isThinking).toBe(false);
    expect(state.isStreaming).toBe(false);
    expect(state.usage).toEqual(emptyUsage);
  });
});
