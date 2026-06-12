import { create } from 'zustand';
import type { Message, SubagentInfo, ToolCallInfo, UsageStats } from '@shared/types';
import { useConfigStore } from './configStore';
import { translateError } from '@shared/error-messages';

// Token estimation for context size tracking (renderer-side approximate).
// For the authoritative implementation, see engine/src/llm/tokenizer.ts.
function estimateTextTokens(text: string): number {
  if (!text) return 0;
  let tokens = 0;
  let i = 0;

  while (i < text.length) {
    const c = text[i];

    if (/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef]/.test(c)) {
      tokens += 1.5;
      i++;
    } else if (/[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/.test(c)) {
      tokens += 0.8;
      i++;
    } else if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      tokens += 0.2;
      i++;
    } else if (/[a-zA-Z0-9_]/.test(c)) {
      let wordLength = 0;
      while (i < text.length && /[a-zA-Z0-9_]/.test(text[i])) {
        wordLength++;
        i++;
      }
      tokens += wordLength * 0.25 + 1;
    } else if (/^[{}()[\];,.:!=<>+\-*/%&|^~?@#`\\]$/.test(c)) {
      tokens += 1;
      i++;
    } else {
      tokens += 1;
      i++;
    }
  }

  return Math.ceil(tokens);
}

// Token buffer management with flush guarantee
let tokenBuffer = '';
let tokenFlushScheduled = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tokenFlushSetState: ((updater: (state: any) => any) => void) | null = null;

function scheduleTokenFlush() {
  if (tokenFlushScheduled) return;
  tokenFlushScheduled = true;
  requestAnimationFrame(() => {
    tokenFlushScheduled = false;
    if (tokenBuffer && tokenFlushSetState) {
      const buffered = tokenBuffer;
      tokenBuffer = '';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tokenFlushSetState((state: any) => ({
        currentResponse: state.currentResponse + buffered,
      }));
    }
  });
}

/** Flush any pending tokens synchronously - call before stopping stream */
function flushTokensSync() {
  if (tokenBuffer && tokenFlushSetState) {
    const buffered = tokenBuffer;
    tokenBuffer = '';
    tokenFlushScheduled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tokenFlushSetState((state: any) => ({
      currentResponse: state.currentResponse + buffered,
    }));
  }
}

interface ChatState {
  messages: Message[];
  isThinking: boolean;
  isStreaming: boolean;
  currentResponse: string;
  toolCalls: ToolCallInfo[];
  usage: UsageStats;
  activeSessionId: string;
  subagents: SubagentInfo[];

  addMessage: (message: Message) => void;
  setThinking: (thinking: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  appendToken: (token: string) => void;
  addToolCall: (tool: Pick<ToolCallInfo, 'name' | 'args'>) => void;
  finishToolCall: (result: Pick<ToolCallInfo, 'name' | 'output'> & { isError: boolean; truncated?: boolean }) => void;
  finishResponse: (usage: { tokens: number; cost: number; cachedTokens?: number; promptTokens?: number; completionTokens?: number }) => void;
  failResponse: (error: string) => void;
  clearMessages: (sessionId?: string) => void;
  editAndResend: (messageId: string, newContent: string) => string | null;
  regenerateFrom: (messageId: string) => string | null;
  compactMessages: () => void;
  loadMessages: (sessionId: string) => Promise<void>;
  switchSession: (sessionId: string) => void;
  addSubagent: (agent: SubagentInfo) => void;
  updateSubagent: (id: string, updates: Partial<SubagentInfo>) => void;
  clearSubagents: () => void;
}

let responseId = '';
let lastPromptTokens = 0; // Track previous turn's prompt tokens for cache estimation

// Session data interface (messages + usage)
interface SessionData {
  messages: Message[];
  usage: UsageStats;
}

// Debounced save helper - saves both messages and usage
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedSave(sessionId: string, messages: Message[], usage?: UsageStats) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const data: SessionData = {
      messages,
      usage: usage || {
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
      },
    };
    window.api?.messages?.save(sessionId, data).catch(console.error);
  }, 500);
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isThinking: false,
  isStreaming: false,
  currentResponse: '',
  toolCalls: [],
  activeSessionId: 'default',
  subagents: [],
  usage: {
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
  },

  addMessage: (message) => {
    set((state) => {
      const newMessages = [...state.messages, message];
      debouncedSave(state.activeSessionId, newMessages, state.usage);
      return { messages: newMessages };
    });
  },

  setThinking: (thinking) => set({ isThinking: thinking }),

  setStreaming: (streaming) => {
    if (streaming) {
      responseId = Date.now().toString(36);
      tokenFlushSetState = set;
      set({ isStreaming: true, currentResponse: '', isThinking: false, toolCalls: [] });
      return;
    }

    // Flush any pending tokens before stopping
    flushTokensSync();
    tokenFlushSetState = null;

    const { currentResponse, messages } = get();
    if (currentResponse) {
      set({
        isStreaming: false,
        messages: [
          ...messages,
          {
            id: responseId,
            role: 'assistant',
            content: currentResponse,
            timestamp: Date.now(),
          },
        ],
        currentResponse: '',
      });
    } else {
      set({ isStreaming: false });
    }
  },

  appendToken: (token) => {
    tokenBuffer += token;
    scheduleTokenFlush();
  },

  addToolCall: (tool) =>
    set((state) => ({
      toolCalls: [
        ...state.toolCalls,
        {
          id: `${Date.now().toString(36)}-${state.toolCalls.length}`,
          name: tool.name,
          args: tool.args,
          status: 'running',
        },
      ],
      usage: {
        ...state.usage,
        sessionToolCalls: state.usage.sessionToolCalls + 1,
        totalToolCalls: state.usage.totalToolCalls + 1,
      },
    })),

  finishToolCall: (result) =>
    set((state) => {
      const nextCalls = [...state.toolCalls];
      const runningIndex = nextCalls.findLastIndex((tool) => tool.name === result.name && tool.status === 'running');
      if (runningIndex === -1) return state;

      nextCalls[runningIndex] = {
        ...nextCalls[runningIndex],
        status: result.isError ? 'error' : 'done',
        output: result.output,
        truncated: result.truncated,
      };

      return { toolCalls: nextCalls };
    }),

  finishResponse: (usage) => {
    const { currentResponse, messages, usage: prevUsage } = get();
    const updatedMessages = currentResponse
      ? [
          ...messages,
          {
            id: responseId,
            role: 'assistant' as const,
            content: currentResponse,
            timestamp: Date.now(),
            usage: { tokens: usage.tokens, cost: usage.cost, cachedTokens: usage.cachedTokens },
          },
        ]
      : messages;
    // agent-service sends cumulative session stats from UsageTracker.getSessionStats(),
    // so we overwrite session-scoped metrics instead of accumulating to avoid double-counting.
    const promptTokens = usage.promptTokens ?? 0;
    const completionTokens = usage.completionTokens ?? 0;
    // Client-side cache estimation: API prefix caching reuses previous prompt tokens
    const apiCachedTokens = usage.cachedTokens ?? 0;
    const estimatedCached = promptTokens > 0 && lastPromptTokens > 0 && promptTokens > lastPromptTokens
      ? Math.min(lastPromptTokens, promptTokens - completionTokens) // Previous prompt is prefix-cached
      : 0;
    const cachedTokens = apiCachedTokens > 0 ? apiCachedTokens : estimatedCached;
    if (promptTokens > 0) lastPromptTokens = promptTokens;
    // Compute delta for lifetime metrics so cross-session accumulation is preserved
    const sessionTokensDelta = usage.tokens - prevUsage.sessionTokens;
    const sessionCostDelta = usage.cost - prevUsage.sessionCost;
    const { activeSessionId } = get();
    set({
      isStreaming: false,
      isThinking: false,
      messages: updatedMessages,
      currentResponse: '',
      usage: {
        ...prevUsage,
        sessionTokens: usage.tokens,
        sessionCost: usage.cost,
        totalTokens: prevUsage.totalTokens + sessionTokensDelta,
        totalCost: prevUsage.totalCost + sessionCostDelta,
        sessionCachedTokens: cachedTokens,
        sessionPromptTokens: promptTokens,
        sessionCompletionTokens: completionTokens,
        currentPromptTokens: promptTokens || prevUsage.currentPromptTokens, // overwrite with latest turn
      },
    });

    // Get the updated usage for saving
    const updatedUsage = get().usage;
    debouncedSave(activeSessionId, updatedMessages, updatedUsage);

    // Use actual promptTokens from API for context estimation (much more accurate than content estimation)
    const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
      'mimo-v2.5-pro': 1048576,
      'mimo-v2.5': 262144,
      'mimo-v2.5-tts': 128000,
      'mimo-v2.5-tts-voiceclone': 128000,
      'mimo-v2.5-tts-voicedesign': 128000,
    };
    const model = useConfigStore.getState().config.model;
    const contextWindow = MODEL_CONTEXT_WINDOWS[model] || 128000;
    const actualContextTokens = promptTokens > 0
      ? promptTokens
      : updatedMessages.reduce((sum, m) => sum + estimateTextTokens(m.content || '') + 4, 2000);

    // Compress when actual context exceeds 70% of window
    if (actualContextTokens > contextWindow * 0.7) {
      get().compactMessages();
    }
  },

  failResponse: (error) => {
    const { messages, activeSessionId } = get();
    // Translate technical error to user-friendly Chinese message
    const friendlyMessage = translateError(error);
    console.error('[Agent Error]', error); // Log technical error for debugging
    const newMessages: Message[] = [
      ...messages,
      {
        id: Date.now().toString(36),
        role: 'system' as const,
        content: friendlyMessage,
        timestamp: Date.now(),
      },
    ];
    set({
      isStreaming: false,
      isThinking: false,
      currentResponse: '',
      messages: newMessages,
    });
    debouncedSave(activeSessionId, newMessages, get().usage);
  },

  clearMessages: (sessionId) => {
    const targetSessionId = sessionId || get().activeSessionId;
    set({
      activeSessionId: targetSessionId,
      messages: [],
      currentResponse: '',
      toolCalls: [],
      isThinking: false,
      isStreaming: false,
      usage: {
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
      },
      subagents: [],
    });
    window.api?.messages?.save(targetSessionId, []).catch(console.error);
  },

  editAndResend: (messageId, newContent) => {
    const { messages } = get();
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return null;

    // Keep messages before the edited one, replace the edited message content
    const truncated = messages.slice(0, idx);
    const editedMsg: Message = {
      ...messages[idx],
      content: newContent,
      timestamp: Date.now(),
    };
    set({ messages: [...truncated, editedMsg], isThinking: true });
    return newContent;
  },

  regenerateFrom: (messageId) => {
    const { messages } = get();
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1 || messages[idx].role !== 'assistant') return null;

    // Find the user message before this assistant message
    let userMsg: Message | null = null;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMsg = messages[i];
        break;
      }
    }
    if (!userMsg) return null;

    // Remove the assistant message and everything after
    const truncated = messages.slice(0, idx);
    set({ messages: truncated, isThinking: true });
    return userMsg.content;
  },

  compactMessages: () => {
    const { messages, activeSessionId, usage } = get();
    if (messages.length <= 5) return;

    const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
      'mimo-v2.5-pro': 1048576,
      'mimo-v2.5': 262144,
      'mimo-v2.5-tts': 128000,
    };
    const model = useConfigStore.getState().config.model;
    const contextWindow = MODEL_CONTEXT_WINDOWS[model] || 128000;
    const usageRatio = usage.sessionPromptTokens / contextWindow;

    // Determine compression level based on context usage
    let keepCount: number;
    let level: string;
    if (usageRatio > 0.85) {
      // Heavy: keep only last 2 user-assistant pairs
      keepCount = 4;
      level = '重度';
    } else if (usageRatio > 0.70) {
      // Medium: keep half of messages (min 6)
      keepCount = Math.max(6, Math.floor(messages.length / 2));
      level = '中度';
    } else {
      // Light: keep last 60% of messages (min 6), strip early tool results
      keepCount = Math.max(6, Math.floor(messages.length * 0.6));
      level = '轻度';
    }

    const removedCount = messages.length - keepCount;
    const earlyMessages = messages.slice(0, -keepCount);
    const keptMessages = messages.slice(-keepCount);

    // Light compression: strip tool results from early messages instead of removing them
    const strippedEarly = level === '轻度'
      ? earlyMessages.map((m) => {
          if (m.role === 'tool' || (m.role === 'assistant' && m.toolCalls?.length)) {
            return { ...m, content: m.content ? '[工具调用结果已压缩]' : m.content, toolCalls: undefined };
          }
          return m;
        }).filter((m) => m.role !== 'tool') // Remove standalone tool messages
      : [];

    const compacted: Message[] = [
      {
        id: 'compact-summary',
        role: 'system' as const,
        content: `[${level}压缩] 上下文使用 ${Math.round(usageRatio * 100)}%，已压缩 ${removedCount} 条消息`,
        timestamp: Date.now(),
      },
      ...strippedEarly,
      ...keptMessages,
    ];
    set({ messages: compacted });
    debouncedSave(activeSessionId, compacted, get().usage);

    // Also compact on the server side
    window.api?.conversation.compact().catch(console.error);
  },

  loadMessages: async (sessionId: string) => {
    const defaultUsage: UsageStats = {
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

    try {
      const result = await window.api?.messages?.load(sessionId);

      // Handle both old format (array) and new format (object with messages + usage)
      let messages: Message[] = [];
      let usage: UsageStats = defaultUsage;

      if (result?.messages) {
        if (Array.isArray(result.messages)) {
          // Old format: just messages array
          messages = result.messages;
        } else if (result.messages.messages) {
          // New format: { messages, usage }
          messages = result.messages.messages;
          usage = result.messages.usage || defaultUsage;
        }
      }

      set({
        messages,
        activeSessionId: sessionId,
        usage,
      });
    } catch {
      set({
        messages: [],
        activeSessionId: sessionId,
        usage: defaultUsage,
      });
    }
  },

  switchSession: (sessionId: string) => {
    // Save current messages before switching
    const { messages, activeSessionId } = get();
    if (messages.length > 0) {
      window.api?.messages?.save(activeSessionId, messages).catch(console.error);
    }
    // Load new session messages and reset usage
    get().loadMessages(sessionId);
    // Clear subagents when switching sessions
    set({ subagents: [] });
  },

  addSubagent: (agent) => {
    set((state) => ({ subagents: [...state.subagents, agent] }));
  },

  updateSubagent: (id, updates) => {
    set((state) => ({
      subagents: state.subagents.map((sa) => (sa.id === id ? { ...sa, ...updates } : sa)),
    }));
  },

  clearSubagents: () => set({ subagents: [] }),
}));
