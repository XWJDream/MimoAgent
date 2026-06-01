import { create } from 'zustand';
import type { Message, ToolCallInfo, UsageStats } from '@shared/types';
import { useConfigStore } from './configStore';

let tokenBuffer = '';
let tokenFlushScheduled = false;
let tokenFlushCallback: (() => void) | null = null;

function scheduleTokenFlush() {
  if (tokenFlushScheduled) return;
  tokenFlushScheduled = true;
  requestAnimationFrame(() => {
    tokenFlushScheduled = false;
    if (tokenBuffer) {
      tokenFlushCallback?.();
    }
  });
}

interface ChatState {
  messages: Message[];
  isThinking: boolean;
  isStreaming: boolean;
  currentResponse: string;
  toolCalls: ToolCallInfo[];
  usage: UsageStats;
  activeSessionId: string;

  addMessage: (message: Message) => void;
  setThinking: (thinking: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  appendToken: (token: string) => void;
  addToolCall: (tool: Pick<ToolCallInfo, 'name' | 'args'>) => void;
  finishToolCall: (result: Pick<ToolCallInfo, 'name' | 'output'> & { isError: boolean }) => void;
  finishResponse: (usage: { tokens: number; cost: number; cachedTokens?: number; promptTokens?: number; completionTokens?: number }) => void;
  failResponse: (error: string) => void;
  clearMessages: () => void;
  editAndResend: (messageId: string, newContent: string) => string | null;
  regenerateFrom: (messageId: string) => string | null;
  compactMessages: () => void;
  loadMessages: (sessionId: string) => Promise<void>;
  switchSession: (sessionId: string) => void;
}

let responseId = '';

// Debounced save helper
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedSave(sessionId: string, messages: Message[]) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    window.api?.messages?.save(sessionId, messages).catch(console.error);
  }, 500);
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isThinking: false,
  isStreaming: false,
  currentResponse: '',
  toolCalls: [],
  activeSessionId: 'default',
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
  },

  addMessage: (message) => {
    set((state) => {
      const newMessages = [...state.messages, message];
      debouncedSave(state.activeSessionId, newMessages);
      return { messages: newMessages };
    });
  },

  setThinking: (thinking) => set({ isThinking: thinking }),

  setStreaming: (streaming) => {
    if (streaming) {
      responseId = Date.now().toString(36);
      set({ isStreaming: true, currentResponse: '', isThinking: false, toolCalls: [] });
      return;
    }

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
    tokenFlushCallback = () => {
      set((state) => ({
        currentResponse: state.currentResponse + tokenBuffer,
      }));
      tokenBuffer = '';
    };
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
    const newSessionTokens = prevUsage.sessionTokens + usage.tokens;
    const { activeSessionId } = get();
    set({
      isStreaming: false,
      isThinking: false,
      messages: updatedMessages,
      currentResponse: '',
      usage: {
        ...prevUsage,
        sessionTokens: newSessionTokens,
        sessionCost: prevUsage.sessionCost + usage.cost,
        totalTokens: prevUsage.totalTokens + usage.tokens,
        totalCost: prevUsage.totalCost + usage.cost,
        sessionCachedTokens: (prevUsage.sessionCachedTokens ?? 0) + (usage.cachedTokens ?? 0),
        sessionPromptTokens: (prevUsage.sessionPromptTokens ?? 0) + (usage.promptTokens ?? 0),
        sessionCompletionTokens: (prevUsage.sessionCompletionTokens ?? 0) + (usage.completionTokens ?? 0),
      },
    });
    debouncedSave(activeSessionId, updatedMessages);

    // Estimate current context size from message content
    // Each message adds to the context sent to the API
    const estimatedContextTokens = updatedMessages.reduce((sum, m) => {
      // Rough estimate: 1 token ≈ 4 chars for Chinese/English mixed content
      return sum + Math.ceil((m.content?.length || 0) / 3) + 50; // +50 for role/formatting overhead
    }, 2000); // +2000 for system prompt

    const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
      'mimo-v2.5-pro': 1048576,
      'mimo-v2.5': 262144,
      'mimo-v2.5-tts': 128000,
      'mimo-v2.5-tts-voiceclone': 128000,
      'mimo-v2.5-tts-voicedesign': 128000,
    };
    const model = useConfigStore.getState().config.model;
    const contextWindow = MODEL_CONTEXT_WINDOWS[model] || 128000;

    // Compress when estimated context exceeds 70% of window
    if (estimatedContextTokens > contextWindow * 0.7) {
      get().compactMessages();
    }
  },

  failResponse: (error) => {
    const { messages, activeSessionId } = get();
    const newMessages: Message[] = [
      ...messages,
      {
        id: Date.now().toString(36),
        role: 'system' as const,
        content: `运行失败：${error}`,
        timestamp: Date.now(),
      },
    ];
    set({
      isStreaming: false,
      isThinking: false,
      currentResponse: '',
      messages: newMessages,
    });
    debouncedSave(activeSessionId, newMessages);
  },

  clearMessages: () => {
    const { activeSessionId } = get();
    set({
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
      },
    });
    window.api?.messages?.save(activeSessionId, []).catch(console.error);
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
    const { messages, activeSessionId } = get();
    if (messages.length <= 5) return;
    window.api?.conversation.compact().then(() => {
      const { messages: currentMessages } = get();
      if (currentMessages.length > 5) {
        const compacted: Message[] = [
          {
            id: 'compact-summary',
            role: 'system' as const,
            content: '[对话历史已自动压缩]',
            timestamp: Date.now(),
          },
          ...currentMessages.slice(-6),
        ];
        set({ messages: compacted });
        debouncedSave(activeSessionId, compacted);
      }
    }).catch(console.error);
  },

  loadMessages: async (sessionId: string) => {
    try {
      const result = await window.api?.messages?.load(sessionId);
      if (result?.messages && result.messages.length > 0) {
        set({ messages: result.messages, activeSessionId: sessionId });
      } else {
        set({ messages: [], activeSessionId: sessionId });
      }
    } catch {
      set({ messages: [], activeSessionId: sessionId });
    }
  },

  switchSession: (sessionId: string) => {
    // Save current messages before switching
    const { messages, activeSessionId } = get();
    if (messages.length > 0) {
      window.api?.messages?.save(activeSessionId, messages).catch(console.error);
    }
    // Load new session messages
    get().loadMessages(sessionId);
  },
}));
