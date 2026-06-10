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
  // Flush any pending token buffer from previous test by toggling streaming
  // setStreaming(true) assigns tokenFlushSetState, setStreaming(false) calls flushTokensSync
  useChatStore.getState().setStreaming(true);
  useChatStore.getState().setStreaming(false);
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

describe('chatStore - appendToken', () => {
  it('buffers tokens and flushes to currentResponse after rAF', async () => {
    useChatStore.getState().setStreaming(true);

    useChatStore.getState().appendToken('Hello');
    useChatStore.getState().appendToken(' World');

    // requestAnimationFrame is mocked to setTimeout(..., 0) in setup.ts
    await new Promise((r) => setTimeout(r, 10));

    expect(useChatStore.getState().currentResponse).toBe('Hello World');
  });
});

describe('chatStore - addToolCall', () => {
  it('adds a tool call with running status', () => {
    useChatStore.getState().addToolCall({ name: 'read_file', args: { path: '/tmp' } });

    const { toolCalls } = useChatStore.getState();
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]).toMatchObject({
      name: 'read_file',
      args: { path: '/tmp' },
      status: 'running',
    });
    expect(toolCalls[0].id).toBeTruthy();
  });

  it('increments session and total tool call counters', () => {
    useChatStore.setState({
      usage: { ...emptyUsage, sessionToolCalls: 2, totalToolCalls: 3 },
    });

    useChatStore.getState().addToolCall({ name: 'grep', args: { pattern: 'foo' } });

    const { usage } = useChatStore.getState();
    expect(usage.sessionToolCalls).toBe(3);
    expect(usage.totalToolCalls).toBe(4);
  });
});

describe('chatStore - finishToolCall', () => {
  it('marks matching running tool call as done', () => {
    useChatStore.setState({
      toolCalls: [
        { id: 't1', name: 'read_file', args: {}, status: 'running' },
      ],
    });

    useChatStore.getState().finishToolCall({ name: 'read_file', output: 'file contents', isError: false });

    const { toolCalls } = useChatStore.getState();
    expect(toolCalls[0].status).toBe('done');
    expect(toolCalls[0].output).toBe('file contents');
  });

  it('marks matching running tool call as error when isError is true', () => {
    useChatStore.setState({
      toolCalls: [
        { id: 't1', name: 'write_file', args: {}, status: 'running' },
      ],
    });

    useChatStore.getState().finishToolCall({ name: 'write_file', output: 'permission denied', isError: true });

    expect(useChatStore.getState().toolCalls[0].status).toBe('error');
    expect(useChatStore.getState().toolCalls[0].output).toBe('permission denied');
  });

  it('updates the last running tool call when multiple exist with same name', () => {
    useChatStore.setState({
      toolCalls: [
        { id: 't1', name: 'read_file', args: {}, status: 'done', output: 'first' },
        { id: 't2', name: 'read_file', args: {}, status: 'running' },
      ],
    });

    useChatStore.getState().finishToolCall({ name: 'read_file', output: 'second', isError: false });

    const { toolCalls } = useChatStore.getState();
    expect(toolCalls[0].status).toBe('done');
    expect(toolCalls[0].output).toBe('first');
    expect(toolCalls[1].status).toBe('done');
    expect(toolCalls[1].output).toBe('second');
  });

  it('does nothing when no running tool call matches', () => {
    useChatStore.setState({
      toolCalls: [
        { id: 't1', name: 'read_file', args: {}, status: 'done', output: 'ok' },
      ],
    });

    useChatStore.getState().finishToolCall({ name: 'read_file', output: 'new', isError: false });

    expect(useChatStore.getState().toolCalls[0].output).toBe('ok');
  });
});

describe('chatStore - finishResponse (overwrite semantics)', () => {
  it('overwrites session tokens instead of accumulating', () => {
    useChatStore.getState().setStreaming(true);
    useChatStore.setState({
      currentResponse: 'first response',
      usage: { ...emptyUsage, sessionTokens: 50, totalTokens: 50 },
    });

    useChatStore.getState().finishResponse({ tokens: 200, cost: 0.04 });

    const { usage } = useChatStore.getState();
    // sessionTokens overwritten to 200, not 50 + 200
    expect(usage.sessionTokens).toBe(200);
    // totalTokens accumulates the delta: 50 + (200 - 50) = 200
    expect(usage.totalTokens).toBe(200);
    expect(usage.sessionCost).toBeCloseTo(0.04);
  });

  it('records promptTokens and completionTokens', () => {
    useChatStore.getState().setStreaming(true);
    useChatStore.setState({ currentResponse: 'response' });

    useChatStore.getState().finishResponse({
      tokens: 500,
      cost: 0.1,
      promptTokens: 300,
      completionTokens: 200,
    });

    const { usage } = useChatStore.getState();
    expect(usage.sessionPromptTokens).toBe(300);
    expect(usage.sessionCompletionTokens).toBe(200);
    expect(usage.currentPromptTokens).toBe(300);
  });

  it('clears currentResponse and stops streaming', () => {
    useChatStore.getState().setStreaming(true);
    useChatStore.setState({ currentResponse: 'some text' });

    useChatStore.getState().finishResponse({ tokens: 10, cost: 0.001 });

    const state = useChatStore.getState();
    expect(state.currentResponse).toBe('');
    expect(state.isStreaming).toBe(false);
    expect(state.isThinking).toBe(false);
  });
});

describe('chatStore - failResponse', () => {
  it('adds a system message with translated error', () => {
    useChatStore.getState().failResponse('ECONNREFUSED');

    const { messages } = useChatStore.getState();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('system');
    // translateError maps ECONNREFUSED to a Chinese network error message
    expect(messages[0].content).toContain('网络');
  });

  it('resets streaming and thinking state', () => {
    useChatStore.setState({ isStreaming: true, isThinking: true, currentResponse: 'partial' });

    useChatStore.getState().failResponse('timeout error');

    const state = useChatStore.getState();
    expect(state.isStreaming).toBe(false);
    expect(state.isThinking).toBe(false);
    expect(state.currentResponse).toBe('');
  });
});

describe('chatStore - switchSession', () => {
  it('saves current messages and loads new session', async () => {
    const saveMock = window.api!.messages!.save as ReturnType<typeof vi.fn>;
    const loadMock = window.api!.messages!.load as ReturnType<typeof vi.fn>;

    useChatStore.setState({
      activeSessionId: 'session-a',
      messages: [{ id: 'm1', role: 'user', content: 'hello', timestamp: 1 }],
    });

    loadMock.mockResolvedValueOnce({
      messages: {
        messages: [{ id: 'm2', role: 'user', content: 'new session', timestamp: 2 }],
        usage: { ...emptyUsage, sessionTokens: 42 },
      },
    });

    useChatStore.getState().switchSession('session-b');

    // switchSession calls save on the old session
    expect(saveMock).toHaveBeenCalledWith('session-a', expect.any(Array));

    // loadMessages is async; wait for it
    await vi.waitFor(() => {
      expect(useChatStore.getState().activeSessionId).toBe('session-b');
    });

    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].content).toBe('new session');
    expect(state.usage.sessionTokens).toBe(42);
  });

  it('clears subagents when switching sessions', async () => {
    const loadMock = window.api!.messages!.load as ReturnType<typeof vi.fn>;
    loadMock.mockResolvedValueOnce({ messages: [] });

    useChatStore.setState({
      activeSessionId: 'old',
      subagents: [{ id: 'sa1', name: 'sub', prompt: 'test', status: 'running', toolCalls: 0, inputTokens: 0, outputTokens: 0, totalCost: 0 }],
    });

    useChatStore.getState().switchSession('new');

    await vi.waitFor(() => {
      expect(useChatStore.getState().activeSessionId).toBe('new');
    });

    expect(useChatStore.getState().subagents).toEqual([]);
  });
});
