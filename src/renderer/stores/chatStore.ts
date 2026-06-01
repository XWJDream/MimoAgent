import { create } from 'zustand';
import type { Message, ToolCallInfo, UsageStats } from '@shared/types';

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

  addMessage: (message: Message) => void;
  setThinking: (thinking: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  appendToken: (token: string) => void;
  addToolCall: (tool: Pick<ToolCallInfo, 'name' | 'args'>) => void;
  finishToolCall: (result: Pick<ToolCallInfo, 'name' | 'output'> & { isError: boolean }) => void;
  finishResponse: (usage: { tokens: number; cost: number }) => void;
  failResponse: (error: string) => void;
  clearMessages: () => void;
  editAndResend: (messageId: string, newContent: string) => string | null;
  regenerateFrom: (messageId: string) => string | null;
}

let responseId = '';

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isThinking: false,
  isStreaming: false,
  currentResponse: '',
  toolCalls: [],
  usage: {
    sessionTokens: 0,
    sessionCost: 0,
    sessionToolCalls: 0,
    totalTokens: 0,
    totalCost: 0,
    totalToolCalls: 0,
  },

  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),

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
            usage: { tokens: usage.tokens, cost: usage.cost },
          },
        ]
      : messages;
    set({
      isStreaming: false,
      isThinking: false,
      messages: updatedMessages,
      currentResponse: '',
      usage: {
        ...prevUsage,
        sessionTokens: prevUsage.sessionTokens + usage.tokens,
        sessionCost: prevUsage.sessionCost + usage.cost,
        totalTokens: prevUsage.totalTokens + usage.tokens,
        totalCost: prevUsage.totalCost + usage.cost,
      },
    });

    // Auto-compress conversation when it gets too long
    if (updatedMessages.length > 30) {
      window.api?.conversation.compact().then(() => {
        const { messages: currentMessages } = get();
        if (currentMessages.length > 30) {
          set({
            messages: [
              {
                id: 'compact-summary',
                role: 'system',
                content: '[对话历史已自动压缩]',
                timestamp: Date.now(),
              },
              ...currentMessages.slice(-10),
            ],
          });
        }
      }).catch(console.error);
    }
  },

  failResponse: (error) => {
    const { messages } = get();
    set({
      isStreaming: false,
      isThinking: false,
      currentResponse: '',
      messages: [
        ...messages,
        {
          id: Date.now().toString(36),
          role: 'system',
          content: `运行失败：${error}`,
          timestamp: Date.now(),
        },
      ],
    });
  },

  clearMessages: () =>
    set({
      messages: [],
      currentResponse: '',
      toolCalls: [],
      isThinking: false,
      isStreaming: false,
    }),

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
}));
